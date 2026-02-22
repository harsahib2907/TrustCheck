import { useState, useEffect } from "react";
import { ScanLine, Package, Check, ChevronRight, Loader2 } from "lucide-react";
import { DashboardLayout } from "../components/DashboardLayout";
import { TCButton } from "../components/TCButton";
import { apiFetch } from "../lib/api";

interface ScanRecord {
  id: string;
  cartonId: string;
  productCount: number;
  timestamp: string;
  origin: string;
  status: "verified" | "processing" | "flagged";
}

const mockScans: ScanRecord[] = [
  { id: "s1", cartonId: "CTN-MHC-2026-0847", productCount: 48, timestamp: "2026-02-20 13:45", origin: "Lecce, Italy", status: "verified" },
  { id: "s2", cartonId: "CTN-MHC-2026-0848", productCount: 48, timestamp: "2026-02-20 11:20", origin: "Lecce, Italy", status: "verified" },
  { id: "s3", cartonId: "CTN-MHC-2026-0849", productCount: 24, timestamp: "2026-02-19 16:30", origin: "Lecce, Italy", status: "verified" },
  { id: "s4", cartonId: "CTN-ML-2026-0210", productCount: 12, timestamp: "2026-02-19 10:15", origin: "Florence, Italy", status: "flagged" },
  { id: "s5", cartonId: "CTN-MHC-2026-0850", productCount: 48, timestamp: "2026-02-18 14:00", origin: "Lecce, Italy", status: "verified" },
];

export function DistributorDashboard() {
  const [scans] = useState(mockScans);
  const [bulkUpdate, setBulkUpdate] = useState<{ active: boolean; current: number; total: number; done: boolean }>({
    active: false,
    current: 0,
    total: 0,
    done: false,
  });
  const [scanSimulated, setScanSimulated] = useState(false);

  // Simulate bulk update progress
useEffect(() => {
  apiFetch<any[]>("/distributor/scans").then(data => {
    if (data && data.length > 0) {
      const mapped: ScanRecord[] = data.map((s, i) => ({
        id:           String(s.id ?? i),
        cartonId:     s.carton_id   ?? `CTN-${i}`,
        productCount: s.item_count  ?? 0,
        timestamp:    s.scanned_at?.replace("T", " ").slice(0, 16) ?? "—",
        origin:       s.origin      ?? "Unknown",
        status:       s.status      ?? "verified",
      }));
      // Note: scans state is initialized from mockScans; real data would replace it
      // setScans(mapped); — uncomment if scans state is made mutable
    }
  }).catch(() => {});
}, []);

  const handleScanCarton = () => {
    setScanSimulated(true);
    const total = 48;
    setBulkUpdate({ active: true, current: 0, total, done: false });

    let current = 0;
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 4) + 2;
      if (current >= total) {
        clearInterval(interval);
        setBulkUpdate({ active: false, current: total, total, done: true });
      } else {
        setBulkUpdate((prev) => ({ ...prev, current }));
      }
    }, 80);
  };

  const statusStyles: Record<string, { bg: string; color: string; label: string; icon: React.ReactNode }> = {
    verified: {
      bg: "rgba(0, 255, 148, 0.08)",
      color: "var(--trust-green)",
      label: "VERIFIED",
      icon: <Check size={12} />,
    },
    processing: {
      bg: "rgba(0, 212, 255, 0.08)",
      color: "var(--accent-cyan)",
      label: "PROCESSING",
      icon: <Loader2 size={12} className="animate-spin" />,
    },
    flagged: {
      bg: "rgba(255, 51, 51, 0.08)",
      color: "var(--trust-red)",
      label: "FLAGGED",
      icon: <span style={{ fontSize: "12px" }}>!</span>,
    },
  };

  return (
    <DashboardLayout role="distributor">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1
            className="font-syne"
            style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}
          >
            Distributor Dashboard
          </h1>
          <p
            className="font-mono-ibm mt-1"
            style={{ fontSize: "13px", color: "var(--text-secondary)" }}
          >
            Global Logistics Partners BV — Rotterdam Hub
          </p>
        </div>
        <TCButton
          variant="primary"
          icon={<ScanLine size={16} />}
          onClick={handleScanCarton}
        >
          Scan Carton
        </TCButton>
      </div>

      {/* Bulk update progress */}
      {(bulkUpdate.active || bulkUpdate.done) && (
        <div
          className="mb-6 p-5 rounded-[4px] animate-slide-up"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: `1px solid ${bulkUpdate.done ? "rgba(0, 255, 148, 0.3)" : "var(--tc-border)"}`,
          }}
        >
          {!bulkUpdate.done ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent-cyan)" }} />
                  <span
                    className="font-mono-ibm"
                    style={{ fontSize: "13px", color: "var(--text-primary)" }}
                  >
                    Updating items in carton...
                  </span>
                </div>
                <span
                  className="font-mono-ibm"
                  style={{ fontSize: "13px", color: "var(--accent-cyan)" }}
                >
                  {bulkUpdate.current} of {bulkUpdate.total}
                </span>
              </div>
              <div
                className="w-full h-[6px] rounded-[3px] overflow-hidden"
                style={{ backgroundColor: "var(--bg-raised)" }}
              >
                <div
                  className="h-full rounded-[3px] transition-all duration-150"
                  style={{
                    width: `${(bulkUpdate.current / bulkUpdate.total) * 100}%`,
                    backgroundColor: "var(--accent-cyan)",
                    boxShadow: "0 0 8px rgba(0, 212, 255, 0.4)",
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="w-[36px] h-[36px] rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: "rgba(0, 255, 148, 0.1)",
                  border: "1px solid rgba(0, 255, 148, 0.3)",
                }}
              >
                <Check size={18} style={{ color: "var(--trust-green)" }} />
              </div>
              <div>
                <span
                  className="font-syne block"
                  style={{ fontSize: "15px", fontWeight: 700, color: "var(--trust-green)" }}
                >
                  Bulk Update Complete
                </span>
                <span
                  className="font-mono-ibm block mt-0.5"
                  style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                >
                  {bulkUpdate.total} items verified and custody transferred — CTN-MHC-2026-0851
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Cartons Today", value: "3", color: "var(--accent-cyan)" },
          { label: "Items Processed", value: "168", color: "var(--trust-green)" },
          { label: "Flagged Items", value: "12", color: "var(--trust-red)" },
          { label: "Avg. Scan Time", value: "2.1s", color: "var(--text-secondary)" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-4 rounded-[4px]"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--tc-border)",
            }}
          >
            <span
              className="font-mono-ibm block uppercase tracking-[0.15em]"
              style={{ fontSize: "10px", color: "var(--text-dim)" }}
            >
              {stat.label}
            </span>
            <span
              className="font-syne block mt-2"
              style={{ fontSize: "24px", fontWeight: 700, color: stat.color, lineHeight: 1 }}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Recent scans */}
      <section
        className="p-5 rounded-[4px]"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--tc-border)",
        }}
      >
        <h2
          className="font-syne mb-5"
          style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}
        >
          Recent Scans
        </h2>

        <div className="flex flex-col gap-2">
          {scans.map((scan) => {
            const status = statusStyles[scan.status];
            return (
              <div
                key={scan.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-[4px] transition-colors duration-150"
                style={{
                  backgroundColor: "var(--bg-raised)",
                  border: "1px solid var(--tc-border)",
                }}
              >
                <Package size={18} style={{ color: "var(--text-dim)" }} className="flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span
                      className="font-syne-mono"
                      style={{ fontSize: "13px", color: "var(--text-primary)" }}
                    >
                      {scan.cartonId}
                    </span>
                    <span
                      className="font-mono-ibm flex items-center gap-1 px-2 py-0.5 rounded-[8px]"
                      style={{
                        fontSize: "10px",
                        color: status.color,
                        backgroundColor: status.bg,
                      }}
                    >
                      {status.icon}
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className="font-mono-ibm"
                      style={{ fontSize: "11px", color: "var(--text-dim)" }}
                    >
                      {scan.productCount} items
                    </span>
                    <span
                      className="font-mono-ibm"
                      style={{ fontSize: "11px", color: "var(--text-dim)" }}
                    >
                      {scan.origin}
                    </span>
                    <span
                      className="font-mono-ibm"
                      style={{ fontSize: "11px", color: "var(--text-dim)" }}
                    >
                      {scan.timestamp}
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: "var(--text-dim)" }} className="flex-shrink-0 hidden sm:block" />
              </div>
            );
          })}
        </div>
      </section>
    </DashboardLayout>
  );
}
