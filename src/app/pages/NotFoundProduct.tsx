import { useNavigate } from "react-router";
import { ScanLine, AlertOctagon, ArrowLeft } from "lucide-react";
import { TCButton } from "../components/TCButton";

export function NotFoundProduct() {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 flex flex-col noise-bg"
      style={{
        backgroundColor: "var(--bg-base)",
        background: `radial-gradient(circle at center, rgba(255, 51, 51, 0.02) 0%, var(--bg-base) 60%)`,
      }}
    >
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
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div
          className="w-[80px] h-[80px] rounded-full flex items-center justify-center mb-6"
          style={{
            backgroundColor: "rgba(255, 51, 51, 0.06)",
            border: "2px solid rgba(255, 51, 51, 0.2)",
          }}
        >
          <AlertOctagon size={36} style={{ color: "var(--trust-red)" }} />
        </div>

        <h1
          className="font-syne text-center"
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          Product Not Found
        </h1>

        <p
          className="font-mono-ibm mt-4 text-center max-w-[440px]"
          style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.7, letterSpacing: "0.02em" }}
        >
          This product could not be identified. It may be a counterfeit item
          or an unregistered product not yet in the TrustCheck verification network.
        </p>

        <div
          className="mt-6 p-4 rounded-[4px] max-w-[440px] w-full"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--tc-border)",
          }}
        >
          <p
            className="font-mono-ibm text-center"
            style={{ fontSize: "11px", color: "var(--text-dim)", lineHeight: 1.6 }}
          >
            If you believe this product should be registered, contact the
            manufacturer or report this scan to{" "}
            <span style={{ color: "var(--accent-cyan)" }}>support@trustcheck.io</span>
          </p>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-[440px]">
          <TCButton
            variant="primary"
            fullWidth
            icon={<ScanLine size={16} />}
            onClick={() => navigate("/")}
          >
            Scan Another Item
          </TCButton>
          <TCButton
            variant="ghost"
            fullWidth
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate("/")}
          >
            Return to Scanner
          </TCButton>
        </div>

        {/* Error reference */}
        <p
          className="font-syne-mono mt-8"
          style={{ fontSize: "11px", color: "var(--text-dim)" }}
        >
          REF: ERR-404-PRODUCT-NF — {new Date().toISOString()}
        </p>
      </div>
    </div>
  );
}
