import { useEffect, useState } from "react";
import { Package, Truck, ScanLine, AlertTriangle, CheckCircle } from "lucide-react";

export interface ActivityItem {
  id: string;
  type: "batch_created" | "scan" | "shipment" | "alert" | "verified";
  message: string;
  timestamp: string;
  isNew?: boolean;
}

const iconMap = {
  batch_created: Package,
  scan: ScanLine,
  shipment: Truck,
  alert: AlertTriangle,
  verified: CheckCircle,
};

const colorMap = {
  batch_created: "var(--accent-cyan)",
  scan: "var(--text-secondary)",
  shipment: "var(--trust-orange)",
  alert: "var(--trust-red)",
  verified: "var(--trust-green)",
};

interface ActivityFeedProps {
  items: ActivityItem[];
  maxItems?: number;
}

export function ActivityFeed({ items, maxItems = 8 }: ActivityFeedProps) {
  const [displayItems, setDisplayItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    setDisplayItems(items.slice(0, maxItems));
  }, [items, maxItems]);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <span
          className="font-mono-ibm uppercase tracking-[0.15em]"
          style={{ fontSize: "11px", color: "var(--text-secondary)" }}
        >
          Activity Feed
        </span>
        <div
          className="w-[6px] h-[6px] rounded-full"
          style={{ backgroundColor: "var(--trust-green)" }}
          title="Live"
        />
      </div>
      <div className="flex flex-col gap-1">
        {displayItems.map((item) => {
          const Icon = iconMap[item.type];
          const color = colorMap[item.type];
          return (
            <div
              key={item.id}
              className={`flex items-start gap-3 py-3 px-3 rounded-[4px] ${
                item.isNew ? "animate-slide-in-right" : ""
              }`}
              style={{
                backgroundColor: item.isNew ? "rgba(0, 212, 255, 0.03)" : "transparent",
              }}
            >
              <Icon
                size={14}
                className="flex-shrink-0 mt-[2px]"
                style={{ color }}
              />
              <div className="flex-1 min-w-0">
                <p
                  className="font-mono-ibm truncate"
                  style={{ fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.4 }}
                >
                  {item.message}
                </p>
                <p
                  className="font-mono-ibm mt-1"
                  style={{ fontSize: "10px", color: "var(--text-dim)" }}
                >
                  {item.timestamp}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
