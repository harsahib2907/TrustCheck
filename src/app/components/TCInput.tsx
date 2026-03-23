import { useState, forwardRef, type InputHTMLAttributes } from "react";

interface TCInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const TCInput = forwardRef<HTMLInputElement, TCInputProps>(
  ({ label, error, className = "", ...props }, ref) => {
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
          {/* Left border indicator */}
          <div
            className="absolute left-0 top-0 w-[3px] rounded-[2px] transition-all duration-150"
            style={{
              height: focused ? "100%" : "0%",
              backgroundColor: error ? "var(--trust-red)" : "var(--accent-cyan)",
              top: focused ? "0%" : "50%",
            }}
          />
          <input
            ref={ref}
            onFocus={(e) => {
              setFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              props.onBlur?.(e);
            }}
            className="w-full px-4 py-3 rounded-[4px] font-mono-ibm outline-none transition-colors duration-150"
            style={{
              fontSize: "14px",
              backgroundColor: "var(--bg-raised)",
              border: `1px solid ${error ? "var(--trust-red)" : focused ? "var(--accent-cyan)" : "var(--tc-border)"}`,
              color: "var(--text-primary)",
              minHeight: "44px",
            }}
            {...props}
          />
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

TCInput.displayName = "TCInput";
