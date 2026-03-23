import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { ScanLine, LogIn } from "lucide-react";
import { QRScannerViewfinder } from "../components/QRScannerViewfinder";

export function ScanPage() {
  const navigate = useNavigate();
  const [scanSuccess, setScanSuccess] = useState(false);
  const [flash, setFlash] = useState(false);

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
      </header>

      {/* Scanner area - centered */}
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