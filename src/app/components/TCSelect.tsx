import { useState, forwardRef, type SelectHTMLAttributes } from "react";

interface TCSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const TCSelect = forwardRef<HTMLSelectElement, TCSelectProps>(
  ({ label, error, options, placeholder, className = "", ...props }, ref) => {
    const [focused, setFocused] = useState(false);

    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {label && (
          <label
            className="font-mono-ibm uppercase tracking-[0.15em]"
            style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}
          >
            {label}
          </label>
        )}
        <div className="relative">
          <div
            className="absolute left-0 top-0 w-[3px] rounded-[2px] transition-all duration-150"
            style={{
              height: focused ? "100%" : "0%",
              backgroundColor: error ? "var(--trust-red)" : "var(--accent-cyan)",
              top: focused ? "0%" : "50%",
            }}
          />
          <select
            ref={ref}
            onFocus={(e) => {
              setFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              props.onBlur?.(e);
            }}
            className="w-full px-4 py-3 rounded-[4px] font-mono-ibm outline-none appearance-none transition-colors duration-150"
            style={{
              fontSize: "14px",
              backgroundColor: "var(--bg-raised)",
              border: `1px solid ${error ? "var(--trust-red)" : focused ? "var(--accent-cyan)" : "var(--tc-border)"}`,
              color: "var(--text-primary)",
              minHeight: "44px",
            }}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {/* Dropdown arrow */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M3 4.5L6 7.5L9 4.5"
                stroke="var(--text-secondary)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        {error && (
          <span
            className="font-mono-ibm"
            style={{ fontSize: "11px", color: "var(--trust-red)" }}
          >
            {error}
          </span>
        )}
      </div>
    );
  }
);

TCSelect.displayName = "TCSelect";
