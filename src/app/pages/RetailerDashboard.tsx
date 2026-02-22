import { useState, useEffect } from "react";
import { ScanLine, Package, Check, ShieldCheck, Boxes, Clock } from "lucide-react";
import { DashboardLayout } from "../components/DashboardLayout";
import { TCButton } from "../components/TCButton";
import { apiFetch } from "../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface IncomingCarton {
  id:              string;
  cartonId:        string;
  productName:     string;
  items:           number;
  receivedAt:      string;
  journeyComplete: boolean;
  source:          string;
}

interface ShelfReadyProduct {
  name:    string;
  count:   number;
  batchId: string;
  verified: boolean;
}

// ── Static fallback data ──────────────────────────────────────────────────────

const fallbackCartons: IncomingCarton[] = [
  { id: "c1", cartonId: "CTN-MHC-2026-0847", productName: 'Organic EVOO "Terra Aurea"',  items: 48, receivedAt: "2026-02-20 13:45", journeyComplete: true,  source: "Lecce, Italy"    },
  { id: "c2", cartonId: "CTN-MHC-2026-0848", productName: 'Organic EVOO "Terra Aurea"',  items: 48, receivedAt: "2026-02-20 11:20", journeyComplete: true,  source: "Lecce, Italy"    },
  { id: "c3", cartonId: "CTN-MHC-2026-0849", productName: "Cold-Pressed Lemon Oil",       items: 24, receivedAt: "2026-02-19 16:30", journeyComplete: true,  source: "Lecce, Italy"    },
  { id: "c4", cartonId: "CTN-ML-2026-0210",  productName: "Aged Balsamic Vinegar 12yr",   items: 12, receivedAt: "2026-02-19 10:15", journeyComplete: false, source: "Florence, Italy" },
  { id: "c5", cartonId: "CTN-MHC-2026-0850", productName: 'Organic EVOO "Terra Aurea"',  items: 48, receivedAt: "2026-02-18 14:00", journeyComplete: true,  source: "Lecce, Italy"    },
];

const shelfReady: ShelfReadyProduct[] = [
  { name: 'Organic Extra Virgin Olive Oil "Terra Aurea"', count: 96, batchId: "BATCH-MHC-2026-0193", verified: true },
  { name: "Cold-Pressed Lemon Oil",                       count: 48, batchId: "BATCH-MHC-2026-0194", verified: true },
  { name: "Aged Balsamic Vinegar 12yr",                   count: 24, batchId: "BATCH-MHC-2026-0195", verified: true },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function RetailerDashboard() {
  const [cartons,           setCartons]           = useState<IncomingCarton[]>(fallbackCartons);
  const [scannedCarton,     setScannedCarton]     = useState<string | null>(null);
  const [confirmingJourney, setConfirmingJourney] = useState(false);

  // ── Fetch real scans from backend ───────────────────────────────────────
  useEffect(() => {
    apiFetch<any[]>("/retailer/scans")
      .then((data) => {
        const mapped: IncomingCarton[] = data.map((s, i) => ({
          id:              String(s.id ?? i),
          cartonId:        s.carton_id   ?? `CTN-${i}`,
          productName:     s.item_name   ?? "Unknown Product",
          items:           s.item_count  ?? 0,
          receivedAt:      s.scanned_at?.replace("T", " ").slice(0, 16) ?? "—",
          journeyComplete: s.journey_complete ?? false,
          source:          s.origin      ?? "Unknown",
        }));
        if (mapped.length > 0) setCartons(mapped);
      })
      .catch(() => { /* backend not ready — keep fallback data */ });
  }, []);

  // ── Simulate carton scan ────────────────────────────────────────────────
  const handleScanCarton = () => {
    setConfirmingJourney(true);
    setTimeout(() => {
      setScannedCarton("CTN-MHC-2026-0851");
      setConfirmingJourney(false);
    }, 1500);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <DashboardLayout role="retailer">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-syne" style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Retailer Dashboard
          </h1>
          <p className="font-mono-ibm mt-1" style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Whole Earth Market — Camden, London
          </p>
        </div>
        <TCButton
          variant="primary"
          icon={<ScanLine size={16} />}
          onClick={handleScanCarton}
          disabled={confirmingJourney}
        >
          {confirmingJourney ? "Scanning..." : "Scan Incoming Carton"}
        </TCButton>
      </div>

      {/* Journey confirmation banner */}
      {scannedCarton && (
        <div
          className="mb-6 p-5 rounded-[4px]"
          style={{ backgroundColor: "rgba(0,255,148,0.03)", border: "1px solid rgba(0,255,148,0.2)" }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-[40px] h-[40px] rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "rgba(0,255,148,0.1)", border: "1px solid rgba(0,255,148,0.3)" }}
            >
              <ShieldCheck size={20} style={{ color: "var(--trust-green)" }} />
            </div>
            <div>
              <span className="font-syne block" style={{ fontSize: "15px", fontWeight: 700, color: "var(--trust-green)" }}>
                Journey Complete — Carton Verified
              </span>
              <span className="font-syne-mono block mt-1" style={{ fontSize: "13px", color: "var(--accent-cyan)" }}>
                {scannedCarton}
              </span>
              <span className="font-mono-ibm block mt-2" style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Full chain of custody verified: Supplier → Manufacturer → Distributor → Retailer.
                All 48 items confirmed authentic and ready for shelf placement.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: "Products on Shelf", value: "168", icon: <Boxes size={16} />,     color: "var(--trust-green)"  },
          { label: "Pending Receipt",   value: "1",   icon: <Clock size={16} />,     color: "var(--trust-orange)" },
          { label: "Fully Verified",    value: "100%",icon: <ShieldCheck size={16} />,color: "var(--accent-cyan)" },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-[4px]" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--tc-border)" }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: "var(--text-dim)" }}>
              {stat.icon}
              <span className="font-mono-ibm uppercase tracking-[0.15em]" style={{ fontSize: "10px" }}>{stat.label}</span>
            </div>
            <span className="font-syne block" style={{ fontSize: "28px", fontWeight: 700, color: stat.color, lineHeight: 1 }}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Shelf-ready products */}
      <section className="mb-6 p-5 rounded-[4px]" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--tc-border)" }}>
        <h2 className="font-syne mb-5" style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Products Ready for Shelf
        </h2>
        <div className="flex flex-col gap-2">
          {shelfReady.map((product) => (
            <div
              key={product.batchId}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-[4px]"
              style={{ backgroundColor: "var(--bg-raised)", border: "1px solid var(--tc-border)" }}
            >
              <div
                className="w-[8px] h-[8px] rounded-full flex-shrink-0"
                style={{ backgroundColor: product.verified ? "var(--trust-green)" : "var(--trust-orange)" }}
              />
              <div className="flex-1 min-w-0">
                <span className="font-syne block truncate" style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{product.name}</span>
                <span className="font-syne-mono block mt-0.5" style={{ fontSize: "11px", color: "var(--text-dim)" }}>{product.batchId}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono-ibm" style={{ fontSize: "13px", color: "var(--accent-cyan)" }}>{product.count} units</span>
                {product.verified && (
                  <span
                    className="font-mono-ibm flex items-center gap-1 px-2 py-1 rounded-[8px]"
                    style={{ fontSize: "10px", color: "var(--trust-green)", backgroundColor: "rgba(0,255,148,0.08)" }}
                  >
                    <Check size={10} /> SHELF READY
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Incoming cartons */}
      <section className="p-5 rounded-[4px]" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--tc-border)" }}>
        <h2 className="font-syne mb-5" style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Recent Incoming Cartons
        </h2>
        <div className="flex flex-col gap-2">
          {cartons.map((carton) => (
            <div
              key={carton.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-[4px]"
              style={{ backgroundColor: "var(--bg-raised)", border: "1px solid var(--tc-border)" }}
            >
              <Package size={18} style={{ color: "var(--text-dim)" }} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-syne-mono" style={{ fontSize: "13px", color: "var(--text-primary)" }}>{carton.cartonId}</span>
                  {carton.journeyComplete ? (
                    <span
                      className="font-mono-ibm flex items-center gap-1 px-2 py-0.5 rounded-[8px]"
                      style={{ fontSize: "10px", color: "var(--trust-green)", backgroundColor: "rgba(0,255,148,0.08)" }}
                    >
                      <Check size={10} /> JOURNEY COMPLETE
                    </span>
                  ) : (
                    <span
                      className="font-mono-ibm flex items-center gap-1 px-2 py-0.5 rounded-[8px]"
                      style={{ fontSize: "10px", color: "var(--trust-orange)", backgroundColor: "rgba(255,149,0,0.08)" }}
                    >
                      <Clock size={10} /> IN TRANSIT
                    </span>
                  )}
                </div>
                <span className="font-mono-ibm block truncate" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  {carton.productName} — {carton.items} items
                </span>
                <span className="font-mono-ibm block mt-0.5" style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                  {carton.source} · {carton.receivedAt}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}
