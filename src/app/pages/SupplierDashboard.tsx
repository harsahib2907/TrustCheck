import { useState, useEffect } from "react";
import { Package, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { DashboardLayout } from "../components/DashboardLayout";
import { MassBalanceIndicator } from "../components/MassBalanceIndicator";
import { apiFetch } from "../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MaterialLot {
  id:          string;
  name:        string;
  available:   number;
  total:       number;
  unit:        string;
  certifiedBy: string;
  status:      "in_stock" | "low_stock" | "depleted";
}

interface SupplyOrder {
  id:          string;
  lotId:       string;
  materialName: string;
  quantity:    number;
  unit:        string;
  requestedBy: string;
  status:      "pending" | "fulfilled" | "rejected";
  createdAt:   string;
}

// ── Static fallback data ──────────────────────────────────────────────────────

const fallbackLots: MaterialLot[] = [
  { id: "LOT-OLV-2026-001", name: "Coratina Olives",      available: 700, total: 2500, unit: "kg", certifiedBy: "EU Organic",    status: "in_stock"  },
  { id: "LOT-LMN-2026-003", name: "Amalfi Lemons",        available: 100, total: 1000, unit: "kg", certifiedBy: "GlobalG.A.P.",  status: "low_stock" },
  { id: "LOT-BLS-2026-002", name: "Trebbiano Grape Must", available: 400, total:  600, unit: "L",  certifiedBy: "ISO 22000",     status: "in_stock"  },
  { id: "LOT-TRF-2026-004", name: "Black Truffle Extract",available:  50, total:  400, unit: "kg", certifiedBy: "CITES Cert.",   status: "low_stock" },
];

const fallbackOrders: SupplyOrder[] = [
  { id: "ORD-001", lotId: "LOT-OLV-2026-001", materialName: "Coratina Olives",       quantity: 500, unit: "kg", requestedBy: "Mediterranean Harvest Co.", status: "fulfilled", createdAt: "2026-02-18" },
  { id: "ORD-002", lotId: "LOT-LMN-2026-003", materialName: "Amalfi Lemons",         quantity: 200, unit: "kg", requestedBy: "Mediterranean Harvest Co.", status: "pending",   createdAt: "2026-02-20" },
  { id: "ORD-003", lotId: "LOT-BLS-2026-002", materialName: "Trebbiano Grape Must",  quantity:  80, unit: "L",  requestedBy: "Mediterranean Harvest Co.", status: "pending",   createdAt: "2026-02-21" },
];

const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
  fulfilled: { bg: "rgba(0,255,148,0.08)",  color: "var(--trust-green)",  label: "FULFILLED" },
  pending:   { bg: "rgba(255,149,0,0.08)",  color: "var(--trust-orange)", label: "PENDING"   },
  rejected:  { bg: "rgba(255,51,51,0.08)",  color: "var(--trust-red)",    label: "REJECTED"  },
  in_stock:  { bg: "rgba(0,255,148,0.08)",  color: "var(--trust-green)",  label: "IN STOCK"  },
  low_stock: { bg: "rgba(255,149,0,0.08)",  color: "var(--trust-orange)", label: "LOW STOCK" },
  depleted:  { bg: "rgba(255,51,51,0.08)",  color: "var(--trust-red)",    label: "DEPLETED"  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SupplierDashboard() {
  const [lots,         setLots]         = useState<MaterialLot[]>(fallbackLots);
  const [orders,       setOrders]       = useState<SupplyOrder[]>(fallbackOrders);
  const [loadingLots,  setLoadingLots]  = useState(true);
  const [loadingOrders,setLoadingOrders]= useState(true);

  // ── Fetch real lots ─────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch<any[]>("/supplier/lots")
      .then((data) => {
        const mapped: MaterialLot[] = data.map((l) => ({
          id:          String(l.lot_id   ?? l.id),
          name:        l.material_type   ?? l.name,
          available:   l.available_qty   ?? l.available ?? 0,
          total:       l.total_qty       ?? l.total     ?? 0,
          unit:        l.unit            ?? "kg",
          certifiedBy: l.certification   ?? "Verified",
          status:      (l.available_qty ?? l.available ?? 0) <= 0
                         ? "depleted"
                         : (l.available_qty ?? l.available ?? 0) < (l.total_qty ?? l.total ?? 1) * 0.2
                         ? "low_stock"
                         : "in_stock",
        }));
        if (mapped.length > 0) setLots(mapped);
      })
      .catch(() => { /* keep fallback */ })
      .finally(() => setLoadingLots(false));
  }, []);

  // ── Fetch real orders ───────────────────────────────────────────────────
  useEffect(() => {
    apiFetch<any[]>("/supplier/orders")
      .then((data) => {
        const mapped: SupplyOrder[] = data.map((o, i) => ({
          id:           String(o.order_id ?? o.id ?? i),
          lotId:        String(o.lot_id   ?? "—"),
          materialName: o.material_name   ?? o.item_name ?? "Unknown",
          quantity:     o.quantity        ?? 0,
          unit:         o.unit            ?? "kg",
          requestedBy:  o.requested_by    ?? o.company_name ?? "Unknown Company",
          status:       o.status          ?? "pending",
          createdAt:    o.created_at?.split("T")[0] ?? "—",
        }));
        if (mapped.length > 0) setOrders(mapped);
      })
      .catch(() => { /* keep fallback */ })
      .finally(() => setLoadingOrders(false));
  }, []);

  const totalAvailable = lots.reduce((sum, l) => sum + l.available, 0);
  const lowStockCount  = lots.filter((l) => l.status === "low_stock" || l.status === "depleted").length;
  const pendingOrders  = orders.filter((o) => o.status === "pending").length;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <DashboardLayout role="supplier">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-syne" style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Supplier Dashboard
          </h1>
          <p className="font-mono-ibm mt-1" style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Raw Material Management
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total Available",  value: `${totalAvailable.toLocaleString()} units`, icon: <Package      size={16} />, color: "var(--accent-cyan)"  },
          { label: "Low Stock Alerts", value: String(lowStockCount),                       icon: <AlertTriangle size={16} />, color: "var(--trust-orange)" },
          { label: "Pending Orders",   value: String(pendingOrders),                       icon: <TrendingUp    size={16} />, color: "var(--trust-green)"  },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-[4px]" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--tc-border)" }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: "var(--text-dim)" }}>
              {stat.icon}
              <span className="font-mono-ibm uppercase tracking-[0.15em]" style={{ fontSize: "10px" }}>{stat.label}</span>
            </div>
            <span className="font-syne block" style={{ fontSize: "24px", fontWeight: 700, color: stat.color, lineHeight: 1 }}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Material lots ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <section className="p-5 rounded-[4px] mb-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--tc-border)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-syne" style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                Material Lots
              </h2>
              <span className="font-mono-ibm" style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                {loadingLots ? "Loading…" : `${lots.length} lots`}
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {lots.map((lot) => {
                const st = statusStyles[lot.status];
                return (
                  <div
                    key={lot.id}
                    className="p-4 rounded-[4px]"
                    style={{ backgroundColor: "var(--bg-raised)", border: "1px solid var(--tc-border)" }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-syne block" style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{lot.name}</span>
                        <span className="font-syne-mono"  style={{ fontSize: "10px", color: "var(--text-dim)" }}>{lot.id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono-ibm px-2 py-0.5 rounded-[8px]"
                          style={{ fontSize: "10px", color: st.color, backgroundColor: st.bg, border: `1px solid ${st.color}30` }}
                        >
                          {st.label}
                        </span>
                        <span
                          className="font-mono-ibm px-2 py-0.5 rounded-[8px]"
                          style={{ fontSize: "10px", color: "var(--accent-cyan)", backgroundColor: "rgba(0,212,255,0.08)" }}
                        >
                          {lot.certifiedBy}
                        </span>
                      </div>
                    </div>
                    <MassBalanceIndicator total={lot.total} used={lot.total - lot.available} unit={lot.unit} />
                    <p className="font-mono-ibm mt-2" style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                      {lot.available.toLocaleString()} {lot.unit} available of {lot.total.toLocaleString()} {lot.unit} total
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ── Supply orders ───────────────────────────────────────────── */}
        <div className="w-full lg:w-[340px] flex-shrink-0">
          <section className="p-5 rounded-[4px]" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--tc-border)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-syne" style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                Supply Orders
              </h2>
              <span className="font-mono-ibm" style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                {loadingOrders ? "Loading…" : `${orders.length} orders`}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {orders.map((order) => {
                const st = statusStyles[order.status];
                return (
                  <div
                    key={order.id}
                    className="p-4 rounded-[4px]"
                    style={{ backgroundColor: "var(--bg-raised)", border: "1px solid var(--tc-border)" }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-syne" style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {order.materialName}
                      </span>
                      <span
                        className="font-mono-ibm px-2 py-0.5 rounded-[8px] flex-shrink-0"
                        style={{ fontSize: "10px", color: st.color, backgroundColor: st.bg }}
                      >
                        {st.label}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-mono-ibm" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                        {order.quantity} {order.unit} · {order.requestedBy}
                      </span>
                      <span className="font-mono-ibm" style={{ fontSize: "10px", color: "var(--text-dim)" }}>
                        {order.createdAt} · {order.lotId}
                      </span>
                    </div>
                    {order.status === "pending" && (
                      <div className="flex gap-2 mt-3">
                        <button
                          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-[4px] font-mono-ibm cursor-pointer transition-colors duration-150"
                          style={{ fontSize: "11px", backgroundColor: "rgba(0,255,148,0.1)", color: "var(--trust-green)", border: "1px solid rgba(0,255,148,0.2)" }}
                          onClick={() => {
                            setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: "fulfilled" as const } : o));
                          }}
                        >
                          <CheckCircle size={12} /> Fulfill
                        </button>
                        <button
                          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-[4px] font-mono-ibm cursor-pointer transition-colors duration-150"
                          style={{ fontSize: "11px", backgroundColor: "rgba(255,51,51,0.05)", color: "var(--trust-red)", border: "1px solid rgba(255,51,51,0.15)" }}
                          onClick={() => {
                            setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: "rejected" as const } : o));
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {!loadingOrders && orders.length === 0 && (
                <p className="font-mono-ibm text-center py-6" style={{ fontSize: "12px", color: "var(--text-dim)" }}>
                  No supply orders yet.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
