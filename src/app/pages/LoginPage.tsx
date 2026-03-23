import { useState } from "react";
import { useNavigate } from "react-router";
import { ScanLine } from "lucide-react";
import { TCButton } from "../components/TCButton";
import { GoogleLogin } from "@react-oauth/google";
import { loginWithGoogle } from "../lib/api";
import { GOOGLE_CLIENT_ID, hasGoogleClientId } from "../lib/config";

const ROLES = [
  { value: "company",     label: "Manufacturer" },
  { value: "distributor", label: "Distributor"  },
  { value: "retailer",    label: "Retailer"     },
  { value: "supplier",    label: "Supplier"     },
];

export function LoginPage() {
  const navigate = useNavigate();
  const [role,    setRole]    = useState<string>("company");
  const [error,   setError]   = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [shake,   setShake]   = useState<boolean>(false);
  const googleClientConfigured = hasGoogleClientId();

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 300);
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) {
      setError("Google sign-in failed — no credential received.");
      triggerShake();
      return;
    }
    setLoading(true);
    setError("");
    try {
      await loginWithGoogle(credentialResponse.credential, role);
      navigate(`/dashboard/${role === "company" ? "manufacturer" : role}`);
    } catch (e: any) {
      setError(e.message ?? "Authentication failed.");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError("Google sign-in was cancelled or failed. Please try again.");
    triggerShake();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center noise-bg"
      style={{
        backgroundColor: "var(--bg-base)",
        background: `radial-gradient(circle at center, rgba(0, 212, 255, 0.02) 0%, var(--bg-base) 60%)`,
      }}
    >
      {/* Grid bg */}
      <div
        className="fixed inset-0 pointer-events-none grid-bg"
        style={{
          opacity: 0.15,
          maskImage: "radial-gradient(circle at center, rgba(0,0,0,0.4) 0%, transparent 50%)",
          WebkitMaskImage: "radial-gradient(circle at center, rgba(0,0,0,0.4) 0%, transparent 50%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[400px] px-6">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center gap-3 mb-3">
            <ScanLine size={28} style={{ color: "var(--accent-cyan)" }} />
            <span
              className="font-syne"
              style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}
            >
              TrustCheck
            </span>
          </div>
          <span
            className="font-mono-ibm uppercase tracking-[0.15em]"
            style={{ fontSize: "11px", color: "var(--text-dim)" }}
          >
            Partner Portal
          </span>
        </div>

        {/* Card */}
        <div
          className={`p-6 rounded-[4px] ${shake ? "animate-shake" : ""}`}
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--tc-border)",
          }}
        >
          <h2
            className="font-syne mb-6"
            style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}
          >
            Sign In
          </h2>

          <div className="flex flex-col gap-5">

            {/* Role selector */}
            <div className="flex flex-col gap-2">
              <span
                className="font-mono-ibm uppercase tracking-[0.12em]"
                style={{ fontSize: "10px", color: "var(--text-dim)" }}
              >
                I am a
              </span>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className="py-2 px-3 rounded-[4px] font-mono-ibm transition-all duration-150 cursor-pointer"
                    style={{
                      fontSize: "12px",
                      border: `1px solid ${role === r.value ? "var(--accent-cyan)" : "var(--tc-border)"}`,
                      backgroundColor: role === r.value ? "rgba(0, 212, 255, 0.08)" : "transparent",
                      color: role === r.value ? "var(--accent-cyan)" : "var(--text-secondary)",
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="p-3 rounded-[4px]"
                style={{
                  backgroundColor: "rgba(255, 51, 51, 0.05)",
                  border: "1px solid rgba(255, 51, 51, 0.15)",
                }}
              >
                <p
                  className="font-mono-ibm"
                  style={{ fontSize: "12px", color: "var(--trust-red)" }}
                >
                  {error}
                </p>
              </div>
            )}

            {/* Google login */}
            {!googleClientConfigured ? (
              <div
                className="p-3 rounded-[4px]"
                style={{
                  backgroundColor: "rgba(255, 183, 77, 0.08)",
                  border: "1px solid rgba(255, 183, 77, 0.25)",
                }}
              >
                <p
                  className="font-mono-ibm"
                  style={{ fontSize: "12px", color: "var(--text-primary)" }}
                >
                  Google sign-in is not configured. Set `VITE_GOOGLE_CLIENT_ID` to a valid Google Web OAuth client ID and restart the Vite server.
                </p>
              </div>
            ) : loading ? (
              <TCButton variant="primary" fullWidth disabled>
                Authenticating...
              </TCButton>
            ) : (
              <div className="flex justify-center">
                <GoogleLogin
                  key={GOOGLE_CLIENT_ID}
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme="filled_black"
                  shape="rectangular"
                  size="large"
                  text="signin_with"
                  width="328"
                />
              </div>
            )}

          </div>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate("/")}
            className="font-mono-ibm cursor-pointer transition-colors duration-150"
            style={{ fontSize: "12px", color: "var(--text-dim)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-cyan)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
          >
            Back to Scanner
          </button>
        </div>

      </div>
    </div>
  );
}
