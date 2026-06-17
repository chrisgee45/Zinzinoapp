import { Link, useLocation } from "wouter";
import { BarChart3, Calendar, GraduationCap, Heart, LayoutDashboard, LogOut, Package, Settings as SettingsIcon, Shield, Sparkles } from "lucide-react";
import { type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

interface AuthShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  // Optional content rendered alongside the page title — usually a row of
  // action buttons or a range selector. Sits to the right on desktop,
  // wraps under the title on mobile.
  actions?: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Heart },
  { href: "/advisor", label: "Advisor", icon: Package },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/training", label: "Training", icon: GraduationCap },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
];

function isActive(path: string, location: string): boolean {
  if (path === location) return true;
  if (path === "/dashboard") return location === "/dashboard";
  return location.startsWith(path);
}

export function AuthShell({ children, title, subtitle, actions }: AuthShellProps) {
  const [location, setLocation] = useLocation();
  const { partner, logout } = useAuth();
  const visibleNav = NAV.filter((n) => !n.adminOnly || partner?.isAdmin);

  function handleLogout() {
    logout();
    setLocation("/login");
  }

  // Trim email to first segment for the desktop chrome — full email feels
  // crowded next to the nav. Hover/title still surfaces it.
  const emailDisplay = partner?.email ?? "";
  const emailShort = emailDisplay.length > 28 ? `${emailDisplay.slice(0, 26)}…` : emailDisplay;

  return (
    <div className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-0">
      <header
        className="px-5 sm:px-8 h-16 flex items-center justify-between sticky top-0 z-30 backdrop-blur-xl border-b"
        style={{
          background: "color-mix(in oklab, var(--surface-0) 78%, transparent)",
          borderColor: "var(--border-muted)",
        }}
      >
        <div className="flex items-center gap-7 min-w-0">
          <Link href="/dashboard" className="shrink-0 hover:opacity-90 transition-opacity">
            <BrandMark />
          </Link>
          <nav className="hidden lg:flex items-center gap-0.5">
            {visibleNav.map((item) => {
              const active = isActive(item.href, location);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={active}
                  className="bfa-nav-item"
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {partner && (
            <div
              className="hidden md:flex items-center gap-2 text-xs text-muted-foreground rounded-full px-3 py-1.5 border"
              style={{ borderColor: "var(--border-muted)" }}
              title={emailDisplay}
            >
              <span
                className="h-1.5 w-1.5 rounded-full inline-block"
                style={{ background: "var(--success)", boxShadow: "0 0 0 3px rgba(34,197,94,0.18)" }}
              />
              {emailShort}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      {/* Tablet / desktop secondary nav row — surfaces full nav between
          medium and large breakpoints so the brand lockup stays uncrowded
          but the user still has full reach. */}
      <div
        className="hidden md:flex lg:hidden border-b px-5 sm:px-8 py-2 gap-1 overflow-x-auto"
        style={{ borderColor: "var(--border-muted)", scrollbarWidth: "thin" }}
      >
        {visibleNav.map((item) => {
          const active = isActive(item.href, location);
          return (
            <Link key={item.href} href={item.href} data-active={active} className="bfa-nav-item shrink-0">
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>

      {title && (
        <div
          className="border-b px-5 sm:px-8 py-6 sm:py-7"
          style={{ borderColor: "var(--border-muted)" }}
        >
          <div className="max-w-6xl mx-auto w-full flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-6 justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-2xl sm:text-[28px] font-bold leading-tight">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
          </div>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-5 sm:px-8 py-6 sm:py-8 min-w-0">
        {children}
      </main>

      {/* Mobile bottom nav — premium rail with active pill. Five most-used
          items + an overflow "More" if there are more, but for now we
          fit five (dashboard, leads via dashboard, calendar, analytics,
          settings) and tuck Training + Customers + Advisor + Admin under
          a single tap of "More". Keep it five wide so each target stays
          thumb-friendly. */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 backdrop-blur-xl border-t"
        style={{
          background: "color-mix(in oklab, var(--surface-0) 90%, transparent)",
          borderColor: "var(--border-muted)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="grid grid-cols-5 px-2 pt-1.5 pb-1.5">
          {visibleNav.slice(0, 5).map((item) => {
            const active = isActive(item.href, location);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 py-1.5 rounded-xl text-[10px] font-medium transition relative"
                style={{ color: active ? "var(--gold)" : "rgb(148 163 184)" }}
              >
                {active && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-7 rounded-full"
                    style={{ background: "var(--gold)" }}
                  />
                )}
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

interface SectionProps {
  title: string;
  description?: string;
  icon?: typeof Sparkles;
  children: ReactNode;
  action?: ReactNode;
  // 'strong' renders the section on the elevated card surface — used for
  // primary command surfaces (Today's One Move, Pre-call Intel).
  variant?: "default" | "strong";
}

export function Section({ title, description, icon: Icon, children, action, variant = "default" }: SectionProps) {
  return (
    <section className={`${variant === "strong" ? "bfa-card-strong" : "bfa-card"} p-5 sm:p-6 mb-4 sm:mb-5`}>
      <div className="flex items-start justify-between gap-4 mb-4 sm:mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-[var(--gold)] shrink-0" />}
            <h2 className="font-display text-lg sm:text-xl font-bold">{title}</h2>
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl leading-relaxed">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div>{children}</div>
    </section>
  );
}
