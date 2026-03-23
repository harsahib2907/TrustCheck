import { useParams, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import {
  ScanLine, ArrowLeft, MapPin, Calendar,
  Hash, Leaf, Shield, Clock, Globe, Copy, Check,
} from "lucide-react";
import { TrustScoreBadge } from "../components/TrustScoreBadge";
import { JourneyTimeline, type JourneyNode } from "../components/JourneyTimeline";
import { WarningCard } from "../components/WarningCard";
import { TCButton } from "../components/TCButton";
import { fetchPassport } from "../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductData {
  id:               string;
  name:             string;
  brand:            string;
  category:         string;
  batchId:          string;
  serialNumber:     string;
  trustScore:       number;
  manufacturingDate: string;
  expiryDate:       string;
  origin:           string;
  rawMaterials:     { name: string; source: string; certification: string }[];
  journey:          JourneyNode[];
  scanHistory:      { location: string; timestamp: string; distance?: string }[];
  warning?:         { message: string; details: string };
}

// ── Demo fallback data ────────────────────────────────────────────────────────

const mockProducts: Record<string, ProductData> = {
  "verified-olive-oil": {
    id: "TC-2026-OLV-00847",
    name: 'Organic Extra Virgin Olive Oil "Terra Aurea"',
    brand: "Mediterranean Harvest Co.",
    category: "FOOD & BEVERAGE",
    batchId: "BATCH-MHC-2026-0193",
    serialNumber: "SN-847AE29F",
    trustScore: 96,
    manufacturingDate: "2026-01-15",
    expiryDate: "2028-01-15",
    origin: "Puglia, Italy",
    rawMaterials: [
      { name: "Coratina Olives",    source: "Cooperativa Olivicola, Bari, IT", certification: "EU Organic"    },
      { name: "Glass Bottle 750ml", source: "Vetropack AG, Bülach, CH",        certification: "ISO 9001"      },
      { name: "Cork Seal",          source: "Amorim Cork, Porto, PT",           certification: "FSC Certified" },
    ],
    journey: [
      { id: "j1", label: "Raw Material",  location: "Bari, Italy",      timestamp: "2026-01-08 06:30", status: "completed", type: "warehouse",   details: "Cold-pressed within 4 hours of harvest." },
      { id: "j2", label: "Manufacturing", location: "Lecce, Italy",     timestamp: "2026-01-15 14:20", status: "completed", type: "factory",     details: "Acidity: 0.2%." },
      { id: "j3", label: "Distribution",  location: "Rotterdam, NL",    timestamp: "2026-01-28 09:45", status: "completed", type: "distributor", details: "Shipped via refrigerated freight." },
      { id: "j4", label: "Retail",        location: "London, UK",       timestamp: "2026-02-05 11:00", status: "completed", type: "retail",      details: "Received and shelved." },
      { id: "j5", label: "You",           location: "Current Location", timestamp: "2026-02-22 —",     status: "current",   type: "consumer",    details: "Scanned by consumer." },
    ],
    scanHistory: [
      { location: "Rotterdam Port, NL",   timestamp: "2026-01-28 09:45" },
      { location: "London Warehouse, UK", timestamp: "2026-02-05 11:00" },
      { location: "Your Location",        timestamp: "Now"              },
    ],
  },
  "counterfeit-handbag": {
    id: "TC-2026-HB-00012",
    name: "Luxury Designer Handbag",
    brand: "Unknown",
    category: "FASHION",
    batchId: "BATCH-UNKNOWN",
    serialNumber: "SN-SUSPICIOUS",
    trustScore: 12,
    manufacturingDate: "—",
    expiryDate: "—",
    origin: "Unknown",
    rawMaterials: [],
    journey: [],
    scanHistory: [{ location: "Multiple locations", timestamp: "Suspicious activity" }],
    warning: {
      message: "Counterfeit detected",
      details: "This QR code has been flagged as counterfeit. Do not purchase.",
    },
  },
};

// ── Helper: map backend response → ProductData ────────────────────────────────

function mapBackendToProduct(data: any): ProductData {
  return {
    id:               String(data.product_id ?? data.id),
    name:             data.item_name    ?? "Unknown Product",
    brand:            data.company?.name ?? "TrustCheck Verified",
    category:         "SUPPLY CHAIN VERIFIED",
    batchId:          String(data.batch_id ?? "—"),
    serialNumber:     `SN-${data.product_id ?? data.id}`,
    trustScore:       data.trust_score?.score ?? 80,
    manufacturingDate: data.created_at?.split("T")[0] ?? "—",
    expiryDate:       data.expires_at?.split("T")[0]  ?? "N/A",
    origin:           data.raw_material?.origin        ?? "Verified Origin",
    rawMaterials: data.raw_material
      ? [{
          name:          data.raw_material.material_type ?? "Raw Material",
          source:        `${data.raw_material.supplier_name ?? ""} — ${data.raw_material.origin ?? ""}`,
          certification: data.raw_material.certification ?? "Verified",
        }]
      : [],
    journey: (data.journey ?? []).map((j: any, i: number) => ({
      id:        `j${i}`,
      label:     j.actor_type ?? j.actor ?? "Step",
      location:  j.location  ?? "Unknown",
      timestamp: j.scanned_at ?? "—",
      status:    "completed" as const,
      type:      j.actor_type === "distributor" ? "distributor"
               : j.actor_type === "retailer"    ? "retailer"
               : j.actor_type === "supplier"    ? "warehouse"
               : j.actor_type === "consumer"    ? "consumer"
               : "factory",
      details:   j.notes ?? "",
    })),
    scanHistory: (data.journey ?? []).map((j: any) => ({
      location:  j.location  ?? "Unknown",
      timestamp: j.scanned_at ?? "—",
    })),
    warning:
      data.trust_score?.flags?.length > 0 && data.trust_score?.score < 50
        ? { message: "Suspicious scan pattern detected — possible counterfeit", details: data.trust_score.flags.join(". ") }
        : undefined,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PassportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product,        setProduct]        = useState<ProductData | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [headerVisible,  setHeaderVisible]  = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const [copied,         setCopied]         = useState(false);

  // ── Load product data ─────────────────────────────────────────────────
  useEffect(() => {
    if (!id) { navigate("/product-not-found", { replace: true }); return; }

    const load = async () => {
      // 1. Try real backend
      try {
        const data = await fetchPassport(id);
        setProduct(mapBackendToProduct(data));
        setLoading(false);
        return;
      } catch {
        // fall through to demo data
      }

      // 2. Fall back to demo mock data
      await new Promise((r) => setTimeout(r, 600));
      const demo = mockProducts[id];
      if (demo) {
        setProduct(demo);
      } else {
        navigate("/product-not-found", { replace: true });
      }
      setLoading(false);
    };

    load();
  }, [id, navigate]);

  // ── Entrance animations ───────────────────────────────────────────────
  useEffect(() => {
    const t1 = setTimeout(() => setHeaderVisible(true),  0);
    const t2 = setTimeout(() => setContentVisible(true), 200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(product?.serialNumber ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4" style={{ backgroundColor: "var(--bg-base)" }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent-cyan)", borderTopColor: "transparent" }} />
        <p className="font-mono-ibm" style={{ fontSize: "12px", color: "var(--text-dim)" }}>Verifying product...</p>
      </div>
    );
  }

  if (!product) return null;

  const isRed = product.trustScore < 50;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen noise-bg" style={{ backgroundColor: "var(--bg-base)" }}>

      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none grid-bg"
        style={{
          opacity: 0.3,
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 60%)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 60%)",
        }}
      />

      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-6 py-4"
        style={{
          backgroundColor: "rgba(10, 12, 15, 0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--tc-border)",
          opacity: headerVisible ? 1 : 0,
          transition: "opacity 300ms ease-out",
        }}
      >
        <button onClick={() => navigate("/")} className="flex items-center gap-2 cursor-pointer" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft size={18} />
          <span className="font-mono-ibm hidden sm:inline" style={{ fontSize: "13px" }}>Back to Scanner</span>
        </button>
        <div className="flex items-center gap-3">
          <ScanLine size={18} style={{ color: "var(--accent-cyan)" }} />
          <span className="font-syne" style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>TrustCheck</span>
        </div>
        <div className="w-[100px] sm:w-[140px]" />
      </header>

      {/* Content */}
      <div
        className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8"
        style={{ opacity: contentVisible ? 1 : 0, transition: "opacity 400ms ease-out" }}
      >
        {/* Warning */}
        {isRed && product.warning && (
          <div className="mb-6">
            <WarningCard message={product.warning.message} details={product.warning.details} />
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8">

          {/* ── Left column ──────────────────────────────────────────── */}
          <div className="w-full md:w-[340px] flex-shrink-0">

            {/* Trust score */}
            <div
              className="flex flex-col items-center py-8 rounded-[4px]"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--tc-border)" }}
            >
              <TrustScoreBadge score={product.trustScore} size="lg" />
            </div>

            {/* Product info */}
            <div className="mt-4 p-5 rounded-[4px]" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--tc-border)" }}>
              <span className="font-mono-ibm uppercase tracking-[0.15em]" style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                {product.category}
              </span>
              <h1 className="font-syne mt-2" style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3, letterSpacing: "-0.02em" }}>
                {product.name}
              </h1>
              <p className="font-mono-ibm mt-1" style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                {product.brand}
              </p>

              <div className="mt-5 pt-5 grid grid-cols-2 gap-4" style={{ borderTop: "1px solid var(--tc-border)" }}>
                <MetaItem icon={<Hash size={13} />}     label="Serial Number" value={product.serialNumber}>
                  <button onClick={handleCopy} className="ml-1 cursor-pointer" style={{ color: "var(--text-dim)" }}>
                    {copied
                      ? <Check size={12} style={{ color: "var(--trust-green)" }} />
                      : <Copy  size={12} />
                    }
                  </button>
                </MetaItem>
                <MetaItem icon={<Hash size={13} />}      label="Batch ID"      value={product.batchId} />
                <MetaItem icon={<Calendar size={13} />}  label="Manufactured"  value={product.manufacturingDate} />
                <MetaItem icon={<Calendar size={13} />}  label="Expiry"        value={product.expiryDate} />
                <MetaItem icon={<MapPin size={13} />}    label="Origin"        value={product.origin} />
                <MetaItem icon={<Globe size={13} />}     label="Product ID"    value={product.id} />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-col gap-2">
              <TCButton variant="secondary" fullWidth icon={<ScanLine size={16} />} onClick={() => navigate("/")}>
                Scan Another Item
              </TCButton>
            </div>
          </div>

          {/* ── Right column ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Journey Timeline */}
            <section className="p-5 rounded-[4px]" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--tc-border)" }}>
              <SectionHeader label="Supply Chain Journey" icon={<TruckIcon size={14} />} />
              <div className="mt-6">
                <JourneyTimeline nodes={product.journey} />
              </div>
            </section>

            {/* Raw Materials */}
            {product.rawMaterials.length > 0 && (
              <section className="mt-4 p-5 rounded-[4px]" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--tc-border)" }}>
                <SectionHeader label="Raw Material Origin" icon={<Leaf size={14} />} />
                <div className="mt-4 flex flex-col gap-3">
                  {product.rawMaterials.map((mat, i) => (
                    <div
                      key={i}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3"
                      style={{ borderBottom: i < product.rawMaterials.length - 1 ? "1px solid var(--tc-border)" : "none" }}
                    >
                      <span className="font-mono-ibm flex-1" style={{ fontSize: "13px", color: "var(--text-primary)" }}>{mat.name}</span>
                      <span className="font-mono-ibm"         style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{mat.source}</span>
                      <span
                        className="font-mono-ibm px-2 py-1 rounded-[8px] self-start"
                        style={{ fontSize: "10px", color: "var(--trust-green)", backgroundColor: "rgba(0,255,148,0.08)", border: "1px solid rgba(0,255,148,0.2)" }}
                      >
                        {mat.certification}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Scan History */}
            <section className="mt-4 p-5 rounded-[4px]" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--tc-border)" }}>
              <SectionHeader label="Scan History" icon={<Clock size={14} />} />
              <div className="mt-4 flex flex-col gap-2">
                {product.scanHistory.map((scan, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 py-3"
                    style={{ borderBottom: i < product.scanHistory.length - 1 ? "1px solid var(--tc-border)" : "none" }}
                  >
                    <MapPin size={14} className="flex-shrink-0 mt-[2px]" style={{ color: "var(--text-dim)" }} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-ibm" style={{ fontSize: "13px", color: "var(--text-primary)" }}>{scan.location}</span>
                        <span className="font-mono-ibm" style={{ fontSize: "11px", color: "var(--text-dim)" }}>{scan.timestamp}</span>
                      </div>
                      {scan.distance && (
                        <span className="font-mono-ibm mt-1 inline-block" style={{ fontSize: "11px", color: "var(--trust-red)" }}>
                          {scan.distance}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Digital signature */}
            <div className="mt-4 p-4 rounded-[4px] flex items-center gap-3" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--tc-border)" }}>
              <Shield size={16} style={{ color: "var(--accent-cyan)" }} />
              <div>
                <span className="font-mono-ibm block" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Digital Signature Verified</span>
                <span className="font-syne-mono block mt-1" style={{ fontSize: "11px", color: "var(--text-dim)" }}>SHA-256: a7f3e2…9b4c1d</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TruckIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7"  cy="18" r="2" />
    </svg>
  );
}

function MetaItem({ icon, label, value, children }: { icon: React.ReactNode; label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1" style={{ color: "var(--text-dim)" }}>
        {icon}
        <span className="font-mono-ibm uppercase tracking-[0.15em]" style={{ fontSize: "10px" }}>{label}</span>
      </div>
      <div className="flex items-center">
        <span className="font-syne-mono" style={{ fontSize: "12px", color: "var(--text-secondary)", wordBreak: "break-all" }}>{value}</span>
        {children}
      </div>
    </div>
  );
}

function SectionHeader({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: "var(--accent-cyan)" }}>{icon}</span>
      <h2 className="font-syne" style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
        {label}
      </h2>
    </div>
  );
}
