const TZ = "Europe/Brussels";

/** Offset in minutes of Europe/Brussels vs UTC at the given instant (handles CET/CEST). */
function brusselsOffsetMinutes(utcGuess: Date): number {
  const utcString = utcGuess.toLocaleString("en-US", { timeZone: "UTC" });
  const brusselsString = utcGuess.toLocaleString("en-US", { timeZone: TZ });
  const utcAsDate = new Date(utcString);
  const brusselsAsDate = new Date(brusselsString);
  return (brusselsAsDate.getTime() - utcAsDate.getTime()) / 60000;
}

/** Converts a "YYYY-MM-DD" + "HH:mm" Brussels wall-clock time into the correct UTC Date instant. */
export function brusselsWallTimeToDate(dateStr: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  // First guess: interpret as if it were UTC.
  const guess = new Date(`${dateStr}T00:00:00Z`);
  guess.setUTCMinutes(guess.getUTCMinutes() + h * 60 + m);
  const offset = brusselsOffsetMinutes(guess);
  // Wall time = UTC + offset  =>  UTC = wall time - offset
  return new Date(guess.getTime() - offset * 60000);
}

/** Adds minutes (in wall-clock terms) starting from a "YYYY-MM-DD" date at Brussels midnight. */
export function brusselsDateAtMinutes(dateStr: string, minutesFromMidnight: number): Date {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return brusselsWallTimeToDate(dateStr, `${hh}:${mm}`);
}

/** Returns "YYYY-MM-DD" for the given instant, in Brussels local time. */
export function toBrusselsDateString(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
