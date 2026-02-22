import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  Factory,
  Truck,
  Store,
  Package,
  LogOut,
  Menu,
  X,
  ScanLine,
  LayoutDashboard,
  Zap,
  ChevronDown,
} from "lucide-react";

interface DashboardLayoutProps {
  role: "manufacturer" | "distributor" | "retailer" | "supplier";
  children: React.ReactNode;
}

const roleConfig = {
  manufacturer: {
    label: "MANUFACTURER",
    icon: Factory,
    navItems: [
      { label: "Dashboard", path: "/dashboard/manufacturer", icon: LayoutDashboard },
      { label: "Create Batch", path: "/dashboard/manufacturer/batch/new", icon: Package },
    ],
  },
  distributor: {
    label: "DISTRIBUTOR",
    icon: Truck,
    navItems: [
      { label: "Dashboard", path: "/dashboard/distributor", icon: LayoutDashboard },
    ],
  },
  retailer: {
    label: "RETAILER",
    icon: Store,
    navItems: [
      { label: "Dashboard", path: "/dashboard/retailer", icon: LayoutDashboard },
    ],
  },
  supplier: {
    label: "SUPPLIER",
    icon: Package,
    navItems: [
      { label: "Dashboard", path: "/dashboard/supplier", icon: LayoutDashboard },
    ],
  },
};

const ALL_ROLES: { role: "manufacturer" | "distributor" | "retailer" | "supplier"; label: string; icon: any; path: string }[] = [
  { role: "manufacturer", label: "Manufacturer", icon: Factory, path: "/dashboard/manufacturer" },
  { role: "supplier",     label: "Supplier",     icon: Package, path: "/dashboard/supplier"     },
  { role: "distributor",  label: "Distributor",  icon: Truck,   path: "/dashboard/distributor"  },
  { role: "retailer",     label: "Retailer",     icon: Store,   path: "/dashboard/retailer"     },
];

export function DashboardLayout({ role, children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const config = roleConfig[role];
  const RoleIcon = config.icon;

  const isDemoMode = localStorage.getItem("demo_mode") === "true";

  const handleSwitchRole = (path: string, newRole: string) => {
    localStorage.setItem("user_role", newRole === "manufacturer" ? "company" : newRole);
    setSwitcherOpen(false);
    setSidebarOpen(false);
    navigate(path);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: "var(--bg-base)" }}>
      {/* Demo mode banner */}
      {isDemoMode && (
        <div
          className="flex items-center justify-between px-4 py-2 relative z-50 flex-shrink-0"
          style={{
            backgroundColor: "rgba(255, 195, 0, 0.06)",
            borderBottom: "1px solid rgba(255, 195, 0, 0.15)",
          }}
        >
          <div className="flex items-center gap-2">
            <Zap size={12} style={{ color: "rgba(255, 195, 0, 0.7)" }} />
            <span
              className="font-mono-ibm uppercase tracking-[0.1em]"
              style={{ fontSize: "10px", color: "rgba(255, 195, 0, 0.7)" }}
            >
              Demo Mode
            </span>
          </div>

          {/* Role switcher */}
          <div className="relative">
            <button
              onClick={() => setSwitcherOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-1 rounded-[3px] transition-colors duration-150 cursor-pointer"
              style={{
                border: "1px solid rgba(255, 195, 0, 0.2)",
                color: "rgba(255, 195, 0, 0.7)",
                backgroundColor: switcherOpen ? "rgba(255, 195, 0, 0.06)" : "transparent",
                fontSize: "11px",
              }}
            >
              <span className="font-mono-ibm">Switch Dashboard</span>
              <ChevronDown size={11} style={{ transform: switcherOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </button>

            {switcherOpen && (
              <div
                className="absolute right-0 top-full mt-1 rounded-[4px] overflow-hidden z-50"
                style={{
                  border: "1px solid rgba(255, 195, 0, 0.2)",
                  backgroundColor: "var(--bg-surface)",
                  minWidth: "160px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                }}
              >
                {ALL_ROLES.filter((r) => r.role !== role).map((r) => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.role}
                      onClick={() => handleSwitchRole(r.path, r.role)}
                      className="w-full flex items-center gap-3 px-4 py-3 transition-colors duration-100 cursor-pointer text-left"
                      style={{ color: "var(--text-secondary)" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255, 195, 0, 0.05)";
                        e.currentTarget.style.color = "rgba(255, 195, 0, 0.8)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "var(--text-secondary)";
                      }}
                    >
                      <Icon size={13} />
                      <span className="font-mono-ibm" style={{ fontSize: "12px" }}>{r.label}</span>
                    </button>
                  );
                })}
                <div style={{ borderTop: "1px solid var(--tc-border)" }}>
                  <button
                    onClick={() => { setSwitcherOpen(false); navigate("/"); }}
                    className="w-full flex items-center gap-3 px-4 py-3 transition-colors duration-100 cursor-pointer text-left"
                    style={{ color: "var(--text-dim)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--accent-cyan)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--text-dim)";
                    }}
                  >
                    <ScanLine size={13} />
                    <span className="font-mono-ibm" style={{ fontSize: "12px" }}>Back to Scanner</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 md:hidden"
            style={{ backgroundColor: "var(--overlay)" }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed md:static z-50 h-full w-[260px] flex flex-col
            transition-transform duration-300
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          `}
          style={{
            backgroundColor: "var(--bg-surface)",
            borderRight: "1px solid var(--tc-border)",
          }}
        >
          {/* Logo area */}
          <div
            className="flex items-center justify-between px-6 py-5"
            style={{ borderBottom: "1px solid var(--tc-border)" }}
          >
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => navigate("/")}
            >
              <ScanLine size={20} style={{ color: "var(--accent-cyan)" }} />
              <span
                className="font-syne"
                style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}
              >
                TrustCheck
              </span>
            </div>
            <button
              className="md:hidden p-1"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} style={{ color: "var(--text-secondary)" }} />
            </button>
          </div>

          {/* Role badge */}
          <div className="px-6 py-4">
            <div className="flex items-center gap-2">
              <RoleIcon size={14} style={{ color: "var(--accent-cyan)" }} />
              <span
                className="font-syne-mono uppercase tracking-[0.15em]"
                style={{ fontSize: "11px", color: "var(--accent-cyan)" }}
              >
                {config.label}
              </span>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-3">
            {config.navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const NavIcon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 mb-1 rounded-[4px] relative transition-colors duration-150"
                  style={{
                    backgroundColor: isActive ? "rgba(0, 212, 255, 0.05)" : "transparent",
                    color: isActive ? "var(--accent-cyan)" : "var(--text-secondary)",
                  }}
                >
                  {isActive && (
                    <div
                      className="absolute left-0 top-[8px] bottom-[8px] w-[3px] rounded-r-[2px]"
                      style={{ backgroundColor: "var(--accent-cyan)" }}
                    />
                  )}
                  <NavIcon size={16} />
                  <span
                    className="font-mono-ibm"
                    style={{ fontSize: "13px" }}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Logout / Exit Demo */}
          <div className="px-3 pb-5">
            {isDemoMode ? (
              <button
                onClick={() => {
                  localStorage.removeItem("demo_mode");
                  localStorage.removeItem("user_role");
                  navigate("/");
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-[4px] transition-colors duration-150"
                style={{ color: "rgba(255, 195, 0, 0.5)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255, 195, 0, 0.85)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255, 195, 0, 0.5)")}
              >
                <Zap size={16} />
                <span className="font-mono-ibm" style={{ fontSize: "13px" }}>
                  Exit Demo
                </span>
              </button>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-[4px] transition-colors duration-150"
                style={{ color: "var(--text-dim)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--trust-red)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
              >
                <LogOut size={16} />
                <span className="font-mono-ibm" style={{ fontSize: "13px" }}>
                  Sign Out
                </span>
              </button>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {/* Mobile header */}
          <div
            className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-30"
            style={{
              backgroundColor: "var(--bg-base)",
              borderBottom: "1px solid var(--tc-border)",
            }}
          >
            <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2">
              <Menu size={20} style={{ color: "var(--text-primary)" }} />
            </button>
            <div className="flex items-center gap-2">
              <ScanLine size={16} style={{ color: "var(--accent-cyan)" }} />
              <span
                className="font-syne"
                style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}
              >
                TrustCheck
              </span>
            </div>
            <div className="w-[36px]" />
          </div>

          <div className="p-6 md:p-8 max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

