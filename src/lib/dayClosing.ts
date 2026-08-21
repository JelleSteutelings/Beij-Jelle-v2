import { DayClosing, DB } from "./types";

/** Zoekt het meest recente afsluit-record voor een datum ("YYYY-MM-DD",
 * Brusselse kalenderdag), of null als die dag nooit afgesloten werd. */
export function latestClosingForDate(db: DB, date: string): DayClosing | null {
  const records = db.dayClosings.filter((c) => c.date === date);
  if (records.length === 0) return null;
  return records.reduce((a, b) => (a.closedAt > b.closedAt ? a : b));
}

/** Een dag is "momenteel afgesloten" zodra het meest recente afsluit-record
 * voor die datum nog geen `reopenedAt` heeft. Zie DayClosing in types.ts
 * voor de achtergrond (dag file → definitieve afsluiting). */
export function isDayClosed(db: DB, date: string): boolean {
  const latest = latestClosingForDate(db, date);
  return !!latest && !latest.reopenedAt;
}
