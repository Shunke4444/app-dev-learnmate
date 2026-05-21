"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Book,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Home,
  LogOut,
  MessageSquare,
  Mic,
  Settings,
  Sparkles,
} from "lucide-react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { MascotMini } from "@/components/Mascot";
import { initialOf, useAuth } from "@/lib/auth/store";

const nav = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/talk", label: "Talk", icon: Mic },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/notes", label: "Notes", icon: Book },
  { href: "/quiz", label: "Quiz", icon: Sparkles },
  { href: "/research", label: "Research", icon: FileText },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(href + "/");
}

function pageLabel(pathname: string) {
  for (const item of nav) {
    if (isActive(pathname, item.href)) return item.label;
  }
  return "LearnMate";
}

function SidebarItem({
  href,
  label,
  icon: Icon,
  collapsed,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  collapsed: boolean;
}) {
  const pathname = usePathname() ?? "";
  const active = isActive(pathname, href);

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={
        "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition " +
        (active
          ? "bg-surface2/80 text-foreground ring-1 ring-white/10 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]"
          : "text-muted hover:bg-surface/50 hover:text-foreground ring-1 ring-transparent") +
        (collapsed ? " justify-center px-2" : "")
      }
      aria-current={active ? "page" : undefined}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-6 w-1 -translate-x-2 -translate-y-1/2 rounded-r-full bg-teal"
        />
      )}
      <span
        className={
          "inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-white/5 transition " +
          (active
            ? "bg-black/30 text-teal"
            : "bg-black/15 text-foreground/80 group-hover:bg-black/25")
        }
      >
        <Icon size={18} />
      </span>
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function BottomNavItem({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof Home;
}) {
  const pathname = usePathname() ?? "";
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      className={
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition " +
        (active ? "text-foreground" : "text-muted hover:text-foreground")
      }
      aria-current={active ? "page" : undefined}
      aria-label={label}
    >
      <span
        className={
          "inline-flex h-8 w-8 items-center justify-center rounded-2xl transition " +
          (active
            ? "bg-teal text-black shadow-[0_8px_24px_-8px_rgba(52,224,196,0.7)]"
            : "bg-transparent")
        }
      >
        <Icon size={17} />
      </span>
      <span className="w-full truncate text-center text-[9px] font-semibold tracking-wide">
        {label}
      </span>
    </Link>
  );
}

function UserMenu({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const initial = initialOf(user?.name);

  function handleSignOut() {
    signOut();
    router.replace("/welcome");
  }

  if (compact) {
    return (
      <Menu as="div" className="relative">
        <MenuButton
          aria-label="Account"
          className="grid h-9 w-9 place-items-center rounded-full bg-teal/90 text-xs font-bold text-black ring-1 ring-white/10 transition hover:brightness-95"
        >
          {initial}
        </MenuButton>
        <MenuItems
          anchor="bottom end"
          className="z-50 mt-2 w-56 origin-top-right rounded-2xl bg-surface2/95 p-1.5 text-sm shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7)] ring-1 ring-white/10 backdrop-blur-xl focus:outline-none"
        >
          <div className="px-3 py-2">
            <div className="truncate text-sm font-semibold">
              {user?.name ?? "Guest"}
            </div>
            <div className="truncate text-[11px] text-muted">
              {user?.email ?? (user?.provider === "guest" ? "Guest session" : "Free plan")}
            </div>
          </div>
          <div className="my-1 h-px bg-white/5" />
          <MenuItem>
            {({ focus }) => (
              <button
                type="button"
                onClick={handleSignOut}
                className={
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-foreground/90 transition " +
                  (focus ? "bg-white/5" : "")
                }
              >
                <LogOut size={14} className="text-muted" />
                Sign out
              </button>
            )}
          </MenuItem>
        </MenuItems>
      </Menu>
    );
  }

  return (
    <div className="rounded-2xl bg-surface/55 p-4 ring-1 ring-white/5">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-teal/90 text-xs font-bold text-black">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">
            {user?.name ?? "Guest"}
          </div>
          <div className="truncate text-[11px] text-muted">
            {user?.provider === "guest" ? "Guest session" : "Free plan"}
          </div>
        </div>
        <Menu as="div" className="relative ml-auto">
          <MenuButton
            aria-label="Account menu"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-black/25 text-muted hover:text-foreground"
          >
            <Settings size={15} />
          </MenuButton>
          <MenuItems
            anchor="top end"
            className="z-50 mb-2 w-52 rounded-2xl bg-surface2/95 p-1.5 text-sm shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7)] ring-1 ring-white/10 backdrop-blur-xl focus:outline-none"
          >
            <MenuItem>
              {({ focus }) => (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={
                    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-foreground/90 transition " +
                    (focus ? "bg-white/5" : "")
                  }
                >
                  <LogOut size={14} className="text-muted" />
                  Sign out
                </button>
              )}
            </MenuItem>
          </MenuItems>
        </Menu>
      </div>
    </div>
  );
}

function useAuthGuard() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);

  useEffect(() => {
    if (hydrated && !user) router.replace("/welcome");
  }, [hydrated, user, router]);

  return { ready: hydrated, user };
}

const COLLAPSE_KEY = "lm:sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    // ignore — strict privacy mode
    return false;
  }
}

function useSidebarCollapsed(): [boolean, (next: boolean) => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return readCollapsed();
  });

  function set(next: boolean) {
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }

  return [collapsed, set];
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const label = pageLabel(pathname);
  const { ready, user } = useAuthGuard();
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  if (!ready || !user) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-muted">
        <div className="flex items-center gap-3 text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-teal" />
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh w-full overflow-x-hidden bg-bg text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 lm-aurora"
      />

      <aside
        className={
          "relative z-10 hidden shrink-0 flex-col border-r border-white/5 bg-surface/30 p-5 backdrop-blur-xl transition-[width] duration-200 ease-out lg:flex " +
          (collapsed ? "w-[84px]" : "w-[270px]")
        }
      >
        <Link
          href="/home"
          title={collapsed ? "LearnMate" : undefined}
          className={
            "flex items-center gap-3 rounded-2xl px-2 py-2 " +
            (collapsed ? "justify-center" : "")
          }
        >
          <MascotMini />
          {!collapsed && (
            <div>
              <div className="text-sm font-semibold tracking-tight">LearnMate</div>
              <div className="text-[11px] text-muted">Study companion</div>
            </div>
          )}
        </Link>

        {!collapsed && (
          <div className="mt-7 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Workspace
          </div>
        )}
        <div className={"flex flex-col gap-1 " + (collapsed ? "mt-7" : "mt-2")}>
          {nav.map((item) => (
            <SidebarItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              collapsed={collapsed}
            />
          ))}
        </div>

        <div className="mt-auto pt-6">
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(!collapsed)}
            className="mb-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-2xl bg-surface/55 text-xs font-semibold text-muted ring-1 ring-white/5 hover:bg-surface hover:text-foreground"
          >
            {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
            {!collapsed && <span>Collapse</span>}
          </button>
          <UserMenu compact={collapsed} />
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-white/5 bg-bg/60 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3.5 lg:px-8 lg:py-4">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <Link href="/home" className="inline-flex items-center gap-2">
                <MascotMini />
                <span className="text-sm font-semibold tracking-tight">LearnMate</span>
              </Link>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-sm">
              <span className="text-muted">LearnMate</span>
              <span className="text-muted/50">/</span>
              <span className="font-semibold text-foreground">{label}</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <UserMenu compact />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-3 pb-28 pt-4 sm:px-4 sm:pt-5 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>

        <nav
          aria-label="Primary"
          className="fixed inset-x-3 bottom-3 z-30 lg:hidden"
        >
          <div className="lm-glass-strong flex items-stretch gap-0.5 rounded-3xl px-1.5 py-1.5 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7)]">
            {nav.map((item) => (
              <BottomNavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
              />
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
