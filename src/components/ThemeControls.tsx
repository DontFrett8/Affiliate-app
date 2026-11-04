"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Moon, Smartphone, Sun } from "lucide-react";
import { saveThemePref } from "@/actions/theme";
import type { ThemePref } from "@/lib/theme";

const query = "(prefers-color-scheme: dark)";
function subscribe(cb: () => void) {
  const m = window.matchMedia(query);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
/** Whether the phone itself is in dark mode (false during server render). */
function useSystemDark() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

function apply(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
  const dark = pref === "dark" || (pref === "system" && window.matchMedia(query).matches);
  document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute("content", dark ? "#1b1016" : "#fdf7f5");
}

function useThemePref(initial: ThemePref) {
  const [pref, setPref] = useState<ThemePref>(initial);
  const [, start] = useTransition();
  const choose = (next: ThemePref) => {
    setPref(next);
    apply(next);
    start(() => saveThemePref(next));
  };
  return [pref, choose] as const;
}

/** Round sun/moon button: flips between light and dark. */
export function ThemeToggle({ initial }: { initial: ThemePref }) {
  const [pref, choose] = useThemePref(initial);
  const systemDark = useSystemDark();
  const isDark = pref === "dark" || (pref === "system" && systemDark);
  return (
    <button
      type="button"
      onClick={() => choose(isDark ? "light" : "dark")}
      className="grid h-10 w-10 place-items-center rounded-full border border-border/70 bg-card/80 text-muted shadow-sm backdrop-blur transition hover:text-accent-ink active:scale-95"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

/** Three-way picker for the Settings page. */
export function AppearancePicker({ initial }: { initial: ThemePref }) {
  const [pref, choose] = useThemePref(initial);
  const options: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "system", label: "Match phone", Icon: Smartphone },
  ];
  return (
    <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-1 rounded-full bg-card-2 p-1 ring-1 ring-border/60">
      {options.map(({ value, label, Icon }) => {
        const on = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => choose(value)}
            className={`flex items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold transition ${
              on ? "bg-gradient-to-br from-accent to-accent-2 text-white shadow-[0_6px_16px_-8px_rgb(230_0_35/0.6)]" : "text-muted hover:text-foreground"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        );
      })}
    </div>
  );
}
