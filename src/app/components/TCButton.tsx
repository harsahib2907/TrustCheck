import { useState, useRef, type MouseEvent, type ReactNode } from "react";

interface TCButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  icon?: ReactNode;
}

export function TCButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  type = "button",
  icon,
}: TCButtonProps) {
  const [ripple, setRipple] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const [pressed, setPressed] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top, active: true });
      setTimeout(() => setRipple((r) => ({ ...r, active: false })), 400);
    }
    onClick?.();
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: "var(--accent-cyan)",
      color: "var(--bg-base)",
      border: "none",
    },
    secondary: {
      backgroundColor: "transparent",
      color: "var(--accent-cyan)",
      border: "1px solid var(--accent-cyan)",
    },
    ghost: {
      backgroundColor: "transparent",
      color: "var(--text-secondary)",
      border: "1px solid var(--tc-border)",
    },
    danger: {
      backgroundColor: "rgba(255, 51, 51, 0.1)",
      color: "var(--trust-red)",
      border: "1px solid rgba(255, 51, 51, 0.3)",
    },
  };

  const sizeClasses: Record<string, string> = {
    sm: "px-4 py-2",
    md: "px-6 py-3",
    lg: "px-8 py-4",
  };

  return (
    <button
      ref={btnRef}
      type={type}
      onClick={handleClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      disabled={disabled}
      className={`
        relative overflow-hidden rounded-[4px] font-mono-ibm
        transition-transform duration-100
        ${sizeClasses[size]}
        ${fullWidth ? "w-full" : ""}
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
      `}
      style={{
        ...variantStyles[variant],
        transform: pressed && !disabled ? "scale(0.97)" : "scale(1)",
        fontSize: size === "sm" ? "11px" : "13px",
        fontWeight: 600,
        letterSpacing: "0.05em",
        minHeight: "44px",
      }}
    >
      {ripple.active && (
        <span
          className="absolute rounded-full pointer-events-none"
          style={{
            left: ripple.x - 20,
            top: ripple.y - 20,
            width: 40,
            height: 40,
            background:
              variant === "primary"
                ? "rgba(10, 12, 15, 0.3)"
                : "rgba(0, 212, 255, 0.15)",
            animation: "ripple-expand 400ms ease-out forwards",
          }}
        />
      )}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {icon}
        {children}
      </span>
      <style>{`
        @keyframes ripple-expand {
          from { transform: scale(1); opacity: 1; }
          to { transform: scale(8); opacity: 0; }
        }
      `}</style>
    </button>
  );
}
