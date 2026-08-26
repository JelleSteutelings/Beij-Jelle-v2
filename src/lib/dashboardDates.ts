import { brusselsWallTimeToDate, toBrusselsDateString } from "./tz";

export type Period = "dag" | "week" | "maand" | "jaar";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Maandag van de week die de gegeven datum bevat. */
function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(dateStr, diff);
}

export function computeRange(
  period: Period,
  refDateStr: string
): { start: Date; end: Date; label: string } {
  if (period === "dag") {
    const start = brusselsWallTimeToDate(refDateStr, "00:00");
    const end = brusselsWallTimeToDate(addDays(refDateStr, 1), "00:00");
    const label = new Date(refDateStr + "T12:00:00").toLocaleDateString("nl-BE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return { start, end, label };
  }

  if (period === "week") {
    const monday = mondayOf(refDateStr);
    const nextMonday = addDays(monday, 7);
    const start = brusselsWallTimeToDate(monday, "00:00");
    const end = brusselsWallTimeToDate(nextMonday, "00:00");
    const sunday = addDays(monday, 6);
    const label = `${new Date(monday + "T12:00:00").toLocaleDateString("nl-BE", { day: "numeric", month: "short" })} — ${new Date(sunday + "T12:00:00").toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" })}`;
    return { start, end, label };
  }

  if (period === "maand") {
    const firstOfMonth = refDateStr.slice(0, 8) + "01";
    const firstOfNextMonth = addMonths(firstOfMonth, 1);
    const start = brusselsWallTimeToDate(firstOfMonth, "00:00");
    const end = brusselsWallTimeToDate(firstOfNextMonth, "00:00");
    const label = new Date(firstOfMonth + "T12:00:00").toLocaleDateString("nl-BE", {
      month: "long",
      year: "numeric",
    });
    return { start, end, label };
  }

  // jaar
  const year = refDateStr.slice(0, 4);
  const firstOfYear = `${year}-01-01`;
  const firstOfNextYear = `${Number(year) + 1}-01-01`;
  const start = brusselsWallTimeToDate(firstOfYear, "00:00");
  const end = brusselsWallTimeToDate(firstOfNextYear, "00:00");
  return { start, end, label: year };
}

export function shiftRefDate(period: Period, refDateStr: string, direction: 1 | -1): string {
  if (period === "dag") return addDays(refDateStr, direction);
  if (period === "week") return addDays(refDateStr, direction * 7);
  if (period === "maand") return addMonths(refDateStr, direction);
  // jaar
  return addMonths(refDateStr, direction * 12);
}

export function todayStr(): string {
  return toBrusselsDateString(new Date());
}

/** Groepeer een lijst datums (ISO) in dag-buckets binnen [start,end), of
 * maand-buckets als perPeriod === "jaar" (voor overzichtelijke jaartotalen). */
export function bucketLabelsFor(period: Period, start: Date, end: Date): { key: string; label: string }[] {
  const buckets: { key: string; label: string }[] = [];
  if (period === "jaar") {
    let cur = new Date(start);
    while (cur.getTime() < end.getTime()) {
      const key = toBrusselsDateString(cur).slice(0, 7); // YYYY-MM
      const label = cur.toLocaleDateString("nl-BE", { month: "short" });
      buckets.push({ key, label });
      cur = new Date(cur);
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    return buckets;
  }

  let curStr = toBrusselsDateString(start);
  const endStr = toBrusselsDateString(new Date(end.getTime() - 1));
  let guard = 0;
  while (curStr <= endStr && guard < 400) {
    const label = new Date(curStr + "T12:00:00").toLocaleDateString("nl-BE", {
      day: "numeric",
      month: period === "maand" ? "numeric" : "short",
    });
    buckets.push({ key: curStr, label });
    curStr = addDays(curStr, 1);
    guard++;
  }
  return buckets;
}

export function bucketKeyForDate(period: Period, iso: string): string {
  const dateStr = toBrusselsDateString(new Date(iso));
  return period === "jaar" ? dateStr.slice(0, 7) : dateStr;
}
