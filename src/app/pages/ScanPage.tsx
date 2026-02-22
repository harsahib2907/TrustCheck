import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { ScanLine, LogIn, Factory, Truck, Store, Package, ChevronRight, Zap } from "lucide-react";
import { QRScannerViewfinder } from "../components/QRScannerViewfinder";

const DEMO_DASHBOARDS = [
  { role: "manufacturer", label: "Manufacturer", icon: Factory,  path: "/dashboard/manufacturer", description: "Batches & QR generation" },
  { role: "supplier",     label: "Supplier",     icon: Package,  path: "/dashboard/supplier",     description: "Raw material lots"      },
  { role: "distributor",  label: "Distributor",  icon: Truck,    path: "/dashboard/distributor",  description: "Carton scan & custody"  },
  { role: "retailer",     label: "Retailer",     icon: Store,    path: "/dashboard/retailer",     description: "Receipt & sale tracking"},
];

export function ScanPage() {
  const navigate = useNavigate();
  const [scanSuccess, setScanSuccess] = useState(false);
  const [flash, setFlash] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  const handleDemoNavigate = (path: string, role: string) => {
    localStorage.setItem("demo_mode", "true");
    localStorage.setItem("user_role", role === "manufacturer" ? "company" : role);
    navigate(path);
  };

const handleScan = useCallback((data: string) => {
  if (scanSuccess) return;
  setScanSuccess(true);
  setFlash(true);
  setTimeout(() => setFlash(false), 200);

  setTimeout(() => {
    try {
      // QR codes encode: {"type": "product", "id": 42, "uuid": "...", "expires_at": "..."}
      const parsed = JSON.parse(data.replace(/'/g, '"'));
      if (parsed.type === "product" && parsed.id) {
        navigate(`/passport/${parsed.id}`);
      } else {
        navigate("/product-not-found");
      }
    } catch {
      navigate("/product-not-found");
    }
  }, 600);
}, [navigate, scanSuccess]);

  return (
    <div
      className="flex flex-col noise-bg"
      style={{
        backgroundColor: "var(--bg-base)",
        background: `radial-gradient(circle at center, rgba(0, 212, 255, 0.03) 0%, var(--bg-base) 60%)`,
        minHeight: "100vh",
      }}
    >
      {/* Flash overlay */}
      {flash && (
        <div
          className="fixed inset-0 z-50 pointer-events-none"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.15)",
            animation: "flash 200ms ease-out forwards",
          }}
        />
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 relative z-10">
        <div className="flex items-center gap-3">
          <ScanLine size={22} style={{ color: "var(--accent-cyan)" }} />
          <span
            className="font-syne"
            style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}
          >
            TrustCheck
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Demo Access Button */}
          <button
            onClick={() => setDemoOpen((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-[4px] transition-all duration-150 cursor-pointer"
            style={{
              border: `1px solid ${demoOpen ? "rgba(255, 195, 0, 0.5)" : "rgba(255, 195, 0, 0.3)"}`,
              color: "rgba(255, 195, 0, 0.85)",
              backgroundColor: demoOpen ? "rgba(255, 195, 0, 0.07)" : "transparent",
              minHeight: "44px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255, 195, 0, 0.6)";
              e.currentTarget.style.backgroundColor = "rgba(255, 195, 0, 0.07)";
            }}
            onMouseLeave={(e) => {
              if (!demoOpen) {
                e.currentTarget.style.borderColor = "rgba(255, 195, 0, 0.3)";
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
          >
            <Zap size={14} />
            <span className="font-mono-ibm" style={{ fontSize: "13px" }}>
              Demo
            </span>
          </button>

          {/* Partner Login */}
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-2 px-4 py-2 rounded-[4px] transition-colors duration-150 cursor-pointer"
            style={{
              border: "1px solid var(--tc-border)",
              color: "var(--text-secondary)",
              backgroundColor: "transparent",
              minHeight: "44px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent-cyan)";
              e.currentTarget.style.color = "var(--accent-cyan)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--tc-border)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <LogIn size={16} />
            <span className="font-mono-ibm" style={{ fontSize: "13px" }}>
              Partner Login
            </span>
          </button>
        </div>
      </header>

      {/* Demo Dashboard Panel */}
      {demoOpen && (
        <div
          className="mx-6 mb-2 rounded-[4px] overflow-hidden"
          style={{
            border: "1px solid rgba(255, 195, 0, 0.18)",
            backgroundColor: "rgba(255, 195, 0, 0.02)",
          }}
        >
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ borderBottom: "1px solid rgba(255, 195, 0, 0.12)" }}
          >
            <Zap size={12} style={{ color: "rgba(255, 195, 0, 0.6)" }} />
            <span
              className="font-mono-ibm uppercase tracking-[0.12em]"
              style={{ fontSize: "10px", color: "rgba(255, 195, 0, 0.6)" }}
            >
              Demo Mode — jump to any partner dashboard
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ backgroundColor: "rgba(255, 195, 0, 0.06)" }}>
            {DEMO_DASHBOARDS.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.role}
                  onClick={() => handleDemoNavigate(d.path, d.role)}
                  className="flex flex-col items-start gap-1 px-4 py-4 transition-colors duration-150 cursor-pointer group text-left"
                  style={{ backgroundColor: "var(--bg-base)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255, 195, 0, 0.04)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-base)"; }}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <Icon size={16} style={{ color: "rgba(255, 195, 0, 0.55)" }} />
                    <ChevronRight size={12} style={{ color: "rgba(255, 195, 0, 0.25)" }} />
                  </div>
                  <span className="font-syne" style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                    {d.label}
                  </span>
                  <span className="font-mono-ibm" style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                    {d.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center relative px-4">
        <QRScannerViewfinder
          onScan={handleScan}
          scanning={!scanSuccess}
          success={scanSuccess}
        />

        {/* Instruction text */}
        <div className="mt-8 text-center">
          <p
            className="font-mono-ibm"
            style={{ fontSize: "13px", color: "var(--text-secondary)", letterSpacing: "0.02em" }}
          >
            {scanSuccess ? "Reading product data..." : "Scan QR code to verify product authenticity"}
          </p>
          <p
            className="font-mono-ibm mt-2"
            style={{ fontSize: "11px", color: "var(--text-dim)" }}
          >
            {scanSuccess
              ? "Verifying authenticity"
              : "Grant camera access to begin scanning"}
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex justify-center pb-4 relative z-10">
        <p
          className="font-mono-ibm"
          style={{ fontSize: "11px", color: "var(--text-dim)" }}
        >
          Scan. Know. Trust.
        </p>
      </footer>
    </div>
  );
}
