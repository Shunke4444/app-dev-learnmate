"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Book,
  FileText,
  Home,
  MessageSquare,
  Mic,
  Search,
  Sparkles,
} from "lucide-react";
import { MascotMini } from "@/components/Mascot";

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

function NavItem({
  href,
  label,
  icon: Icon,
  variant,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  variant: "sidebar" | "mobile";
}) {
  const pathname = usePathname() ?? "";
  const active = isActive(pathname, href);

  if (variant === "mobile") {
    return (
      <Link
        href={href}
        className={
          "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-medium ring-1 ring-white/5 transition " +
          (active
            ? "bg-surface2/80 text-foreground"
            : "bg-surface/40 text-muted hover:bg-surface/60 hover:text-foreground")
        }
        aria-current={active ? "page" : undefined}
      >
        <Icon size={16} className={active ? "opacity-100" : "opacity-80"} />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={
        "group flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition ring-1 ring-transparent " +
        (active
          ? "bg-surface2/80 text-foreground ring-white/5"
          : "text-muted hover:bg-surface/50 hover:text-foreground")
      }
      aria-current={active ? "page" : undefined}
    >
      <span
        className={
          "inline-flex h-8 w-8 items-center justify-center rounded-xl ring-1 ring-white/5 transition " +
          (active ? "bg-black/20" : "bg-black/10 group-hover:bg-black/20")
        }
      >
        <Icon size={18} className={active ? "opacity-100" : "opacity-85"} />
      </span>
      <span>{label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const label = pageLabel(pathname);

  return (
    <div className="relative flex min-h-dvh w-full bg-bg text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-100 [background:radial-gradient(1100px_circle_at_18%_12%,rgba(52,224,196,0.14),transparent_60%),radial-gradient(950px_circle_at_88%_18%,rgba(201,167,245,0.13),transparent_58%),radial-gradient(1000px_circle_at_72%_92%,rgba(247,184,210,0.10),transparent_60%)]"
      />

      <aside className="relative hidden w-[280px] flex-col border-r border-white/5 bg-surface/35 p-5 backdrop-blur lg:flex">
        <Link href="/home" className="flex items-center gap-3 rounded-2xl px-2 py-2">
          <MascotMini />
          <div className="text-sm font-semibold tracking-tight">LearnMate</div>
        </Link>

        <div className="mt-6 flex flex-col gap-1">
          {nav.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              variant="sidebar"
            />
          ))}
        </div>

        <div className="mt-auto pt-6 text-xs text-muted">
          Local-first prototype UI
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-white/5 bg-bg/65 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-4 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="lg:hidden">
                <Link href="/home" className="inline-flex items-center gap-2">
                  <MascotMini />
                  <span className="text-sm font-semibold tracking-tight">LearnMate</span>
                </Link>
              </div>
              <div className="hidden lg:block text-sm text-muted">{label}</div>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 rounded-2xl bg-surface/45 px-3 py-2 ring-1 ring-white/5">
                <Search size={16} className="text-muted" />
                <input
                  className="w-[260px] bg-transparent text-sm text-foreground placeholder:text-muted/80 outline-none"
                  placeholder="Search notes, chats, quizzes"
                  type="search"
                />
              </div>
              <div
                className="h-9 w-9 rounded-full bg-surface/55 ring-1 ring-white/5"
                aria-hidden
              />
            </div>
          </div>

          <nav className="lg:hidden border-t border-white/5 px-3 py-3">
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {nav.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  variant="mobile"
                />
              ))}
            </div>
          </nav>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
