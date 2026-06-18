import { Link, useLocation } from "wouter";
import {
  BarChart3,
  Calendar,
  GraduationCap,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
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

// Single source of truth for portal navigation. Both the desktop top-row
// and the mobile drawer iterate this — there's no "5 most-used" mobile
// shortlist that could silently hide Training / Settings / Admin.
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Heart },
  { href: "/advisor", label: "Advisor", icon: Package },
  { href: "/business", label: "Business", icon: TrendingUp },
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
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    setMenuOpen(false);
    logout();
    setLocation("/login");
  }

  // Trim email to first segment for the desktop chrome — full email feels
  // crowded next to the nav. Hover/title still surfaces it.
  const emailDisplay = partner?.email ?? "";
  const emailShort = emailDisplay.length > 28 ? `${emailDisplay.slice(0, 26)}…` : emailDisplay;

  // Auto-close the drawer whenever the route changes (e.g. partner taps a
  // nav item or follows a link inside the page).
  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  // Escape closes the drawer + body scroll lock while it's open so the
  // page behind doesn't scroll on iOS Safari.
  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden flex flex-col">
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
          {/* Desktop horizontal nav — lg and above */}
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
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Email pill — hidden on small screens, shown md+ */}
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
          {/* Sign-out lives in the desktop header chrome only — mobile gets
              it from the drawer. */}
          <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden lg:inline-flex">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
          {/* Mobile / tablet hamburger — visible below lg. Carries every
              authorized nav item AND sign-out so nothing can be missed. */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-full transition"
            style={{
              border: "1px solid var(--border-muted)",
              background: "color-mix(in oklab, var(--surface-2) 60%, transparent)",
              color: "var(--gold)",
            }}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-drawer"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

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

      {/* ── Mobile nav drawer ─────────────────────────────────────────────
          Slides in from the right on tablet / mobile when the hamburger is
          tapped. Backdrop click + Escape close it; route change closes it
          too via the useEffect above. */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation menu"
            className="absolute inset-0 backdrop-blur-md cursor-default"
            style={{ background: "color-mix(in oklab, var(--surface-0) 75%, transparent)" }}
          />
          {/* Drawer panel */}
          <aside
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute top-0 right-0 h-full w-[88%] max-w-sm flex flex-col border-l overflow-hidden"
            style={{
              background: "var(--surface-1)",
              borderColor: "var(--border-muted)",
              boxShadow: "var(--shadow-elev)",
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            <div
              className="flex items-center justify-between gap-3 px-5 h-16 border-b"
              style={{ borderColor: "var(--border-muted)" }}
            >
              <BrandMark compact />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="inline-flex items-center justify-center h-10 w-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-[rgb(var(--overlay-rgb)/0.05)] transition"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {partner && (
              <div
                className="px-5 py-3 border-b text-[12px] text-muted-foreground truncate"
                style={{ borderColor: "var(--border-muted)" }}
                title={emailDisplay}
              >
                <span className="bfa-eyebrow mr-2 text-muted-foreground/70">Signed in as</span>
                <span className="text-foreground">{emailDisplay}</span>
              </div>
            )}

            <nav className="flex-1 overflow-y-auto py-2">
              <ul className="flex flex-col">
                {visibleNav.map((item) => {
                  const active = isActive(item.href, location);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-5 py-3.5 text-[14px] font-semibold transition relative"
                        style={{
                          color: active ? "var(--gold)" : "hsl(var(--foreground))",
                          background: active
                            ? "color-mix(in oklab, var(--gold) 10%, transparent)"
                            : "transparent",
                        }}
                      >
                        {active && (
                          <span
                            aria-hidden
                            className="absolute inset-y-0 left-0 w-[3px]"
                            style={{ background: "var(--gold)" }}
                          />
                        )}
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div
              className="px-5 py-3 border-t"
              style={{ borderColor: "var(--border-muted)" }}
            >
              <Button
                variant="secondary"
                size="md"
                className="w-full justify-center"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </aside>
        </div>
      )}
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
