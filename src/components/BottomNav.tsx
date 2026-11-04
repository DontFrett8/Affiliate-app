"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarHeart, Plus, Search, Settings2 } from "lucide-react";

const tabs = [
  { href: "/", label: "Discover", Icon: Search },
  { href: "/pins/new", label: "Create", Icon: Plus },
  { href: "/queue", label: "Queue", Icon: CalendarHeart },
  { href: "/settings", label: "Settings", Icon: Settings2 },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+0.6rem)]">
      <ul className="mx-auto grid max-w-md grid-cols-4 gap-1 rounded-full border border-border/70 bg-card/85 p-1.5 shadow-rose backdrop-blur-xl">
        {tabs.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-semibold transition ${
                  active ? "bg-accent-soft text-accent-ink" : "text-muted hover:text-foreground"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
