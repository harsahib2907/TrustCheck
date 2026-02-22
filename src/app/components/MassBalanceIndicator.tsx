interface MassBalanceIndicatorProps {
  total: number;
  used: number;
  unit?: string;
  label?: string;
}

export function MassBalanceIndicator({ total, used, unit = "kg", label }: MassBalanceIndicatorProps) {
  const remaining = total - used;
  const percentage = total > 0 ? (remaining / total) * 100 : 0;

  const fillColor =
    percentage <= 0
      ? "var(--trust-red)"
      : percentage < 20
      ? "var(--trust-orange)"
      : "var(--trust-green)";

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-2">
          <span
            className="font-mono-ibm uppercase tracking-[0.15em]"
            style={{ fontSize: "11px", color: "var(--text-secondary)" }}
          >
            {label}
          </span>
          <span
            className="font-mono-ibm"
            style={{ fontSize: "11px", color: "var(--text-dim)" }}
          >
            {percentage.toFixed(0)}% remaining
          </span>
        </div>
      )}
      <div
        className="w-full h-[8px] rounded-[4px] overflow-hidden"
        style={{ backgroundColor: "var(--bg-raised)" }}
      >
        <div
          className="h-full rounded-[4px] transition-all duration-500 ease-out"
          style={{
            width: `${Math.max(percentage, 0)}%`,
            backgroundColor: fillColor,
            boxShadow: `0 0 8px ${fillColor}40`,
          }}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span
          className="font-mono-ibm"
          style={{ fontSize: "11px", color: "var(--text-secondary)" }}
        >
          {used.toLocaleString()} {unit} used
        </span>
        <span
          className="font-mono-ibm"
          style={{ fontSize: "11px", color: fillColor }}
        >
          {remaining.toLocaleString()} {unit} remaining
        </span>
      </div>
    </div>
  );
}
