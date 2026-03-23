import { AlertTriangle } from "lucide-react";

interface WarningCardProps {
  title?: string;
  message: string;
  details?: string;
}

export function WarningCard({ title = "Authenticity Alert", message, details }: WarningCardProps) {
  return (
    <div
      className="relative rounded-[4px] p-6 animate-slide-up"
      style={{
        backgroundColor: "rgba(255, 51, 51, 0.05)",
        borderLeft: "4px solid var(--trust-red)",
        border: "1px solid rgba(255, 51, 51, 0.15)",
        borderLeftWidth: "4px",
        borderLeftColor: "var(--trust-red)",
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex-shrink-0 w-[40px] h-[40px] rounded-full flex items-center justify-center"
          style={{
            backgroundColor: "rgba(255, 51, 51, 0.1)",
          }}
        >
          <AlertTriangle size={20} style={{ color: "var(--trust-red)" }} />
        </div>
        <div className="flex-1">
          <h3
            className="font-syne mb-2"
            style={{ fontSize: "18px", fontWeight: 700, color: "var(--trust-red)" }}
          >
            {title}
          </h3>
          <p
            className="font-mono-ibm"
            style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.6 }}
          >
            {message}
          </p>
          {details && (
            <p
              className="font-mono-ibm mt-3"
              style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.6 }}
            >
              {details}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
