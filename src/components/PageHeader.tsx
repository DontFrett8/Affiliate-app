import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="animate-rise flex items-end justify-between gap-4 pb-1 pt-2 pr-1">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow pr-14 leading-10">{eyebrow}</p>}
        <h1 className="font-display text-[2rem] font-semibold leading-[1.05] tracking-tight">{title}</h1>
        {subtitle && <div className="mt-1.5 text-sm text-muted">{subtitle}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
