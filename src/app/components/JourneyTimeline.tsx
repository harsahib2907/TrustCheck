import { useEffect, useState } from "react";
import { Factory, Truck, Store, Warehouse, User, Check } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

export interface JourneyNode {
  id: string;
  label: string;
  location: string;
  timestamp: string;
  status: "completed" | "active" | "current" | "pending";
  type: "factory" | "distributor" | "retailer" | "warehouse" | "consumer";
  details?: string;
}

const iconMap = {
  factory: Factory,
  distributor: Truck,
  retailer: Store,
  warehouse: Warehouse,
  consumer: User,
};

interface JourneyTimelineProps {
  nodes: JourneyNode[];
  animate?: boolean;
}

export function JourneyTimeline({ nodes, animate = true }: JourneyTimelineProps) {
  const [visibleNodes, setVisibleNodes] = useState(animate ? 0 : nodes.length);

  useEffect(() => {
    if (!animate) return;
    const baseDelay = 400;
    const stagger = 100;

    nodes.forEach((_, i) => {
      setTimeout(() => {
        setVisibleNodes((prev) => Math.max(prev, i + 1));
      }, baseDelay + i * stagger);
    });
  }, [nodes, animate]);

  return (
    <>
      {/* Desktop: Horizontal */}
      <div className="hidden md:block">
        <div className="flex items-start relative">
          {nodes.map((node, i) => {
            const Icon = iconMap[node.type];
            const isVisible = i < visibleNodes;
            const isCompleted = node.status === "completed";
            const isActive = node.status === "active" || node.status === "current";

            return (
              <div
                key={node.id}
                className="flex-1 flex flex-col items-center relative"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(12px)",
                  transition: "opacity 300ms ease-out, transform 300ms ease-out",
                }}
              >
                {/* Connector line */}
                {i < nodes.length - 1 && (
                  <div
                    className="absolute top-[20px] left-[50%] right-[-50%] h-[2px]"
                    style={{
                      backgroundColor: isCompleted ? "var(--trust-green)" : "var(--tc-border)",
                      opacity: isCompleted ? 0.5 : 1,
                    }}
                  />
                )}

                {/* Node circle */}
                <div
                  className={`relative z-10 w-[40px] h-[40px] rounded-full flex items-center justify-center border-2 ${
                    isActive ? "animate-pulse-cyan" : ""
                  }`}
                  style={{
                    backgroundColor: isCompleted
                      ? "rgba(0, 255, 148, 0.1)"
                      : isActive
                      ? "rgba(0, 212, 255, 0.1)"
                      : "var(--bg-raised)",
                    borderColor: isCompleted
                      ? "var(--trust-green)"
                      : isActive
                      ? "var(--accent-cyan)"
                      : "var(--tc-border)",
                  }}
                >
                  {isCompleted ? (
                    <Check size={16} style={{ color: "var(--trust-green)" }} />
                  ) : (
                    <Icon
                      size={16}
                      style={{
                        color: isActive ? "var(--accent-cyan)" : "var(--text-dim)",
                      }}
                    />
                  )}
                </div>

                {/* Label */}
                <span
                  className="font-syne mt-3 text-center"
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: isCompleted
                      ? "var(--text-primary)"
                      : isActive
                      ? "var(--accent-cyan)"
                      : "var(--text-dim)",
                  }}
                >
                  {node.label}
                </span>

                {/* Location */}
                <span
                  className="font-mono-ibm mt-1 text-center"
                  style={{ fontSize: "11px", color: "var(--text-secondary)" }}
                >
                  {node.location}
                </span>

                {/* Timestamp */}
                <span
                  className="font-mono-ibm mt-1 text-center"
                  style={{ fontSize: "11px", color: "var(--text-dim)" }}
                >
                  {node.timestamp}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: Accordion */}
      <div className="block md:hidden">
        <Accordion type="single" collapsible className="w-full">
          {nodes.map((node, i) => {
            const Icon = iconMap[node.type];
            const isCompleted = node.status === "completed";
            const isActive = node.status === "active" || node.status === "current";

            return (
              <AccordionItem
                key={node.id}
                value={node.id}
                className="border-b"
                style={{
                  borderColor: "var(--tc-border)",
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(12px)",
                  transition: "opacity 300ms ease-out, transform 300ms ease-out",
                }}
              >
                <AccordionTrigger className="py-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-[32px] h-[32px] rounded-full flex items-center justify-center border"
                      style={{
                        backgroundColor: isCompleted
                          ? "rgba(0, 255, 148, 0.1)"
                          : isActive
                          ? "rgba(0, 212, 255, 0.1)"
                          : "var(--bg-raised)",
                        borderColor: isCompleted
                          ? "var(--trust-green)"
                          : isActive
                          ? "var(--accent-cyan)"
                          : "var(--tc-border)",
                      }}
                    >
                      {isCompleted ? (
                        <Check size={14} style={{ color: "var(--trust-green)" }} />
                      ) : (
                        <Icon
                          size={14}
                          style={{
                            color: isActive ? "var(--accent-cyan)" : "var(--text-dim)",
                          }}
                        />
                      )}
                    </div>
                    <div className="flex flex-col items-start">
                      <span
                        className="font-syne"
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: isCompleted
                            ? "var(--text-primary)"
                            : isActive
                            ? "var(--accent-cyan)"
                            : "var(--text-dim)",
                        }}
                      >
                        {node.label}
                      </span>
                      <span
                        className="font-mono-ibm"
                        style={{ fontSize: "11px", color: "var(--text-secondary)" }}
                      >
                        {node.location}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-[44px] pb-2">
                    <p
                      className="font-mono-ibm"
                      style={{ fontSize: "11px", color: "var(--text-dim)" }}
                    >
                      {node.timestamp}
                    </p>
                    {node.details && (
                      <p
                        className="font-mono-ibm mt-2"
                        style={{ fontSize: "13px", color: "var(--text-secondary)" }}
                      >
                        {node.details}
                      </p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </>
  );
}
