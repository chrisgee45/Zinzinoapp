import { Link, useLocation } from "wouter";
import { Calendar, GraduationCap, LayoutDashboard, LogOut, Settings as SettingsIcon, Shield, Sparkles } from "lucide-react";
import { type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AuthShellProps {
  children: ReactNode;
  title?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/training", label: "Training", icon: GraduationCap },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
];

export function AuthShell({ children, title }: AuthShellProps) {
  const [location, setLocation] = useLocation();
  const { partner, logout } = useAuth();
  const visibleNav = NAV.filter((n) => !n.adminOnly || partner?.isAdmin);

  function handleLogout() {
    logout();
    setLocation("/login");
  }

  return (
    <div className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden flex flex-col pb-24 sm:pb-0">
      <header className="px-5 sm:px-8 py-4 border-b border-border/40 flex items-center justify-between sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/dashboard" className="shrink-0">
            <BrandMark />
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {visibleNav.map((item) => {
              const active = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                    active
                      ? "bg-[var(--gold)]/15 text-[var(--gold)] ring-1 ring-[var(--gold)]/35"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                  )}
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
            <span className="hidden md:inline text-xs text-muted-foreground">
              {partner.email}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      {title && (
        <div className="border-b border-border/30 px-5 sm:px-8 py-5 max-w-6xl mx-auto w-full">
          <h1 className="font-display text-2xl sm:text-3xl font-bold">{title}</h1>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-5 sm:px-8 py-6 sm:py-10 min-w-0">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur-xl border-t border-border/40 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex justify-around">
        {NAV.map((item) => {
          const active = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl text-[11px] font-medium transition",
                active ? "text-[var(--gold)]" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
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
}

export function Section({ title, description, icon: Icon, children, action }: SectionProps) {
  return (
    <section className="bfa-card p-6 sm:p-7 mb-5">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-[var(--gold)]" />}
            <h2 className="font-display text-xl font-bold">{title}</h2>
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl leading-relaxed">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}
