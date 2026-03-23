import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Plus, Download, Package, Search, ChevronRight } from "lucide-react";
import { DashboardLayout } from "../components/DashboardLayout";
import { MassBalanceIndicator } from "../components/MassBalanceIndicator";
import { ActivityFeed, type ActivityItem } from "../components/ActivityFeed";
import { TCButton } from "../components/TCButton";
import { apiFetch, getBatchQRCode } from "../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Batch {
  id:            string;
  productName:   string;
  batchId:       string;
  quantity:      number;
  status:        "active" | "shipped" | "pending";
  created:       string;
  materialUsed:  number;
  materialTotal: number;
  materialUnit:  string;
}

interface MaterialLot {
  id:        string;
  name:      string;
  available: number;
  total:     number;
  unit:      string;
}

// ── Static config (outside component so it doesn't re-create each render) ─────

const statusColors: Record<string, { bg: string; color: string; label: string }> = {
  active:  { bg: "rgba(0, 255, 148, 0.08)", color: "var(--trust-green)",  label: "ACTIVE"  },
  shipped: { bg: "rgba(0, 212, 255, 0.08)", color: "var(--accent-cyan)",  label: "SHIPPED" },
  pending: { bg: "rgba(255, 149, 0, 0.08)", color: "var(--trust-orange)", label: "PENDING" },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ManufacturerDashboard() {
  const navigate = useNavigate();

  const [activities,   setActivities]   = useState<ActivityItem[]>([
    { id: "a1", type: "verified",      message: "Dashboard loaded",                 timestamp: "Just now", isNew: true  },
    { id: "a2", type: "batch_created", message: "Fetching data from backend...",    timestamp: "—",        isNew: false },
  ]);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [materialLots, setMaterialLots] = useState<MaterialLot[]>([]);
  const [batches,      setBatches]      = useState<Batch[]>([]);
  const [loadingLots,  setLoadingLots]  = useState(true);
  const [loadingBatch, setLoadingBatch] = useState(true);
  const [exportingBatchId, setExportingBatchId] = useState<number | null>(null);

  // ── Fetch material lots ─────────────────────────────────────────────────
  useEffect(() => {
    apiFetch<any[]>("/manufacturer/lots")
      .then((data) => {
        setMaterialLots(
          data.map((l) => ({
            id:        String(l.lot_id   ?? l.id),
            name:      l.material_type   ?? l.name,
            available: l.available_qty   ?? l.available ?? 0,
            total:     l.total_qty       ?? l.total     ?? 0,
            unit:      l.unit            ?? "kg",
          }))
        );
      })
      .catch(() => { /* backend not ready yet — silently ignore */ })
      .finally(() => setLoadingLots(false));
  }, []);

  // ── Fetch batches ───────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch<any[]>("/manufacturer/batches")
      .then((data) => {
        const mapped: Batch[] = data.map((b) => ({
          id:            String(b.batch_id ?? b.id),
          productName:   b.item_name    ?? "Unknown Product",
          batchId:       `BATCH-${b.batch_id ?? b.id}`,
          quantity:      b.total_units  ?? 0,
          status:        b.total_units > 0 && b.sold_units === b.total_units
                           ? "shipped"
                           : b.sold_units  > 0
                           ? "active"
                           : "pending",
          created:       b.created_at?.split("T")[0] ?? "—",
          materialUsed:  b.lot?.qty_used  ?? 0,
          materialTotal: b.lot?.total_qty ?? 0,
          materialUnit:  b.lot?.unit      ?? "kg",
        }));
        setBatches(mapped);
        setActivities((prev) => [
          {
            id:        `fetch-${Date.now()}`,
            type:      "verified" as const,
            message:   `Loaded ${mapped.length} batch${mapped.length !== 1 ? "es" : ""}`,
            timestamp: "Just now",
            isNew:     true,
          },
          ...prev,
        ].slice(0, 8));
      })
      .catch(() => { /* backend not ready yet — silently ignore */ })
      .finally(() => setLoadingBatch(false));
  }, []);

  // ── Filter ──────────────────────────────────────────────────────────────
  const filteredBatches = batches.filter(
    (b) =>
      b.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.batchId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportBatchQr = async (batchId: number, productName: string) => {
    try {
      setExportingBatchId(batchId);
      const { qr } = await getBatchQRCode(batchId);
      const link = document.createElement("a");
      link.href = qr;
      link.download = `${productName.replace(/\s+/g, "-").toLowerCase()}-batch-${batchId}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Failed to export batch QR", error);
      setActivities((prev) => [
        { id: `err-${Date.now()}`, type: "error", message: "Unable to export QR code", timestamp: "Just now", isNew: true },
        ...prev,
      ].slice(0, 8));
    } finally {
      setExportingBatchId(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <DashboardLayout role="manufacturer">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1
            className="font-syne"
            style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}
          >
            Manufacturer Dashboard
          </h1>
          <p className="font-mono-ibm mt-1" style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Mediterranean Harvest Co.
          </p>
        </div>
        <TCButton
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => navigate("/dashboard/manufacturer/batch/new")}
        >
          Create Batch
        </TCButton>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Main content ────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* Raw Material Lots */}
          <section
            className="p-5 rounded-[4px] mb-4"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--tc-border)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-syne" style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                Raw Material Inventory
              </h2>
              <span className="font-mono-ibm" style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                {loadingLots ? "Loading…" : `${materialLots.length} lots registered`}
              </span>
            </div>

            {!loadingLots && materialLots.length === 0 && (
              <p className="font-mono-ibm" style={{ fontSize: "12px", color: "var(--text-dim)" }}>
                No lots found. Connect backend at <code>/manufacturer/lots</code>.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {materialLots.map((lot) => (
                <div key={lot.id} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-ibm" style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                      {lot.name}
                    </span>
                    <span className="font-syne-mono" style={{ fontSize: "10px", color: "var(--text-dim)" }}>
                      {lot.id}
                    </span>
                  </div>
                  <MassBalanceIndicator total={lot.total} used={lot.total - lot.available} unit={lot.unit} />
                </div>
              ))}
            </div>
          </section>

          {/* Batch Registry */}
          <section
            className="p-5 rounded-[4px]"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--tc-border)" }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <h2 className="font-syne" style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                Batch Registry
              </h2>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-dim)" }} />
                <input
                  type="text"
                  placeholder="Search batches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-[4px] font-mono-ibm w-full sm:w-[240px]"
                  style={{ fontSize: "12px", backgroundColor: "var(--bg-raised)", border: "1px solid var(--tc-border)", color: "var(--text-primary)", minHeight: "36px" }}
                />
              </div>
            </div>

            {loadingBatch && (
              <p className="font-mono-ibm" style={{ fontSize: "12px", color: "var(--text-dim)" }}>Loading batches…</p>
            )}

            {!loadingBatch && filteredBatches.length === 0 && (
              <div className="flex flex-col items-center py-10 gap-3">
                <Package size={28} style={{ color: "var(--text-dim)", opacity: 0.4 }} />
                <p className="font-mono-ibm" style={{ fontSize: "12px", color: "var(--text-dim)" }}>
                  No batches yet — create your first batch above.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {filteredBatches.map((batch) => {
                const status = statusColors[batch.status];
                return (
                  <div
                    key={batch.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-[4px] cursor-pointer group transition-colors duration-150"
                    style={{ backgroundColor: "var(--bg-raised)", border: "1px solid var(--tc-border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent-cyan)")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--tc-border)")}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-syne truncate" style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                          {batch.productName}
                        </span>
                        <span
                          className="font-mono-ibm px-2 py-0.5 rounded-[8px] flex-shrink-0"
                          style={{ fontSize: "10px", color: status.color, backgroundColor: status.bg, border: `1px solid ${status.color}30` }}
                        >
                          {status.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-syne-mono" style={{ fontSize: "11px", color: "var(--text-dim)" }}>{batch.batchId}</span>
                        <span className="font-mono-ibm"  style={{ fontSize: "11px", color: "var(--text-dim)" }}>{batch.quantity.toLocaleString()} units</span>
                        <span className="font-mono-ibm"  style={{ fontSize: "11px", color: "var(--text-dim)" }}>{batch.created}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-[120px] hidden sm:block">
                        <MassBalanceIndicator total={batch.materialTotal} used={batch.materialUsed} unit={batch.materialUnit} />
                      </div>
                      <button
                        className="flex items-center gap-1 px-3 py-2 rounded-[4px] cursor-pointer transition-colors duration-150"
                        style={{ border: "1px solid var(--tc-border)", color: "var(--text-secondary)", fontSize: "11px" }}
                        title="Export QR codes"
                        onClick={() => exportBatchQr(Number(batch.id), batch.productName)}
                        disabled={exportingBatchId === Number(batch.id)}
                      >
                        <Download size={13} />
                        <span className="font-mono-ibm hidden md:inline">
                          {exportingBatchId === Number(batch.id) ? "Exporting..." : "QR"}
                        </span>
                      </button>
                      <ChevronRight size={16} style={{ color: "var(--text-dim)" }} className="group-hover:text-[var(--accent-cyan)] transition-colors duration-150" />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ── Activity feed ────────────────────────────────────────────── */}
        <div className="w-full lg:w-[280px] flex-shrink-0">
          <div className="p-4 rounded-[4px] lg:sticky lg:top-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--tc-border)" }}>
            <ActivityFeed items={activities} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
