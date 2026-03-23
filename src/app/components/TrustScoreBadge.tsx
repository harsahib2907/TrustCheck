import { useEffect, useState, useRef } from "react";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

interface TrustScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
}

function getTrustTier(score: number) {
  if (score >= 90) return { label: "VERIFIED", color: "var(--trust-green)", icon: ShieldCheck, pulse: "animate-pulse-green" };
  if (score >= 50) return { label: "SUSPICIOUS", color: "var(--trust-orange)", icon: ShieldAlert, pulse: "" };
  return { label: "COUNTERFEIT RISK", color: "var(--trust-red)", icon: ShieldX, pulse: "animate-pulse-red" };
}

export function TrustScoreBadge({ score, size = "lg", animate = true }: TrustScoreBadgeProps) {
  const [displayScore, setDisplayScore] = useState(animate ? 0 : score);
  const animationRef = useRef<number | null>(null);
  const tier = getTrustTier(score);
  const Icon = tier.icon;

  useEffect(() => {
    if (!animate) {
      setDisplayScore(score);
      return;
    }

    const startTime = Date.now();
    const duration = 800;
    const startDelay = 200;

    const timeout = setTimeout(() => {
      const tick = () => {
        const elapsed = Date.now() - startTime - startDelay;
        const progress = Math.min(elapsed / duration, 1);
        // Cubic ease-out
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayScore(Math.round(eased * score));
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(tick);
        }
      };
      tick();
    }, startDelay);

    return () => {
      clearTimeout(timeout);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [score, animate]);

  const sizeClasses = {
    sm: { badge: "w-[80px] h-[80px]", number: "text-[24px]", label: "text-[9px]", icon: 14 },
    md: { badge: "w-[120px] h-[120px]", number: "text-[36px]", label: "text-[10px]", icon: 18 },
    lg: { badge: "w-[180px] h-[180px]", number: "text-[72px]", label: "text-[11px]", icon: 22 },
  };

  const s = sizeClasses[size];

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`${s.badge} rounded-full flex flex-col items-center justify-center ${tier.pulse}`}
        style={{
          background: `radial-gradient(circle, ${tier.color}10 0%, transparent 70%)`,
          border: `2px solid ${tier.color}40`,
        }}
      >
        <span
          className={`font-syne ${s.number} tracking-tight`}
          style={{ color: tier.color, fontWeight: 800, lineHeight: 1 }}
        >
          {displayScore}
        </span>
      </div>
      <div className="flex items-center gap-2" style={{ color: tier.color }}>
        <Icon size={s.icon} />
        <span
          className={`font-mono-ibm ${s.label} tracking-[0.15em] uppercase`}
          style={{ fontWeight: 600 }}
        >
          {tier.label}
        </span>
      </div>
    </div>
  );
}
