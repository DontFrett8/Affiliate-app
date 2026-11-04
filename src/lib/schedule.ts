import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { addDays } from "date-fns";

export const DEFAULT_TIMES = ["09:00", "12:30", "17:00", "20:30"];

export function normalizeTimes(times: string[]) {
  return Array.from(
    new Set(
      times
        .map((t) => t.trim())
        .filter((t) => /^\d{1,2}:\d{2}$/.test(t))
        .map((t) => {
          const [h, m] = t.split(":").map(Number);
          if (h > 23 || m > 59) return null;
          return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        })
        .filter((t): t is string => !!t),
    ),
  ).sort();
}

/** All slot instants (UTC Dates) for `days` days starting today in the given zone. */
export function slotsFrom(now: Date, times: string[], tz: string, days = 60): Date[] {
  const out = new Map<number, Date>();
  for (let d = 0; d < days; d++) {
    // Calendar date in the target zone, d days from now.
    const ymd = formatInTimeZone(addDays(now, d), tz, "yyyy-MM-dd");
    for (const t of times) {
      // Interpret "yyyy-MM-dd HH:mm" as wall-clock time in tz → UTC instant.
      const slot = fromZonedTime(`${ymd}T${t}:00`, tz);
      out.set(slot.getTime(), slot);
    }
  }
  return Array.from(out.values()).sort((a, b) => a.getTime() - b.getTime());
}

/**
 * First slot that is in the future and not already taken.
 * `taken` = scheduledAt of existing scheduled/posting/posted pins.
 */
export function nextOpenSlot(now: Date, times: string[], tz: string, taken: Date[]): Date {
  const list = normalizeTimes(times.length ? times : DEFAULT_TIMES);
  const takenMs = new Set(taken.map((d) => d.getTime()));
  const minMs = now.getTime() + 2 * 60 * 1000; // leave a 2-minute buffer for the cron
  for (const slot of slotsFrom(now, list, tz)) {
    if (slot.getTime() < minMs) continue;
    if (takenMs.has(slot.getTime())) continue;
    return slot;
  }
  return new Date(minMs);
}

export function formatLocal(d: Date, tz: string, fmt = "EEE MMM d, h:mm a") {
  return formatInTimeZone(d, tz, fmt);
}

/** For <input type="datetime-local"> values. */
export function toLocalInputValue(d: Date, tz: string) {
  return formatInTimeZone(d, tz, "yyyy-MM-dd'T'HH:mm");
}
export function fromLocalInputValue(v: string, tz: string) {
  return fromZonedTime(v, tz);
}

/** Wrapper so server components can read the clock without tripping the purity lint. */
export function nowMs() {
  return Date.now();
}
