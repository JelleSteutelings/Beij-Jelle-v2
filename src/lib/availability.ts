import { Booking, BookingBlock, OpeningHours, DayHours, Service, ServiceBlock } from "./types";
import { brusselsDateAtMinutes, toBrusselsDateString } from "./tz";

export const DAY_KEYS: (keyof OpeningHours)[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Geeft de blokken van een dienst terug; zonder eigen blokken = 1 bezet blok. */
export function getServiceBlocks(service: Service): ServiceBlock[] {
  if (service.blocks && service.blocks.length > 0) return service.blocks;
  return [{ durationMinutes: service.durationMinutes, busy: true }];
}

export function totalBlocksDuration(blocks: ServiceBlock[]): number {
  return blocks.reduce((sum, b) => sum + b.durationMinutes, 0);
}

/** Zet dienst-blokken om in een opslagbare snapshot met offsets, voor op de boeking. */
export function buildBookingBlocks(blocks: ServiceBlock[]): BookingBlock[] {
  let offset = 0;
  const result: BookingBlock[] = [];
  for (const b of blocks) {
    result.push({ offsetMinutes: offset, durationMinutes: b.durationMinutes, busy: b.busy });
    offset += b.durationMinutes;
  }
  return result;
}

type Interval = { start: number; end: number };

/** Enkel de "bezette" sub-periodes van een boeking, als absolute tijdstippen. */
export function bookingBusyIntervals(booking: Booking): Interval[] {
  const baseTime = new Date(booking.start).getTime();
  const blocks: BookingBlock[] =
    booking.blocks && booking.blocks.length > 0
      ? booking.blocks
      : [{ offsetMinutes: 0, durationMinutes: (new Date(booking.end).getTime() - baseTime) / 60000, busy: true }];

  return blocks
    .filter((b) => b.busy)
    .map((b) => ({
      start: baseTime + b.offsetMinutes * 60000,
      end: baseTime + (b.offsetMinutes + b.durationMinutes) * 60000,
    }));
}

function allBusyIntervals(existingBookings: Booking[]): Interval[] {
  return existingBookings
    .filter((b) => b.status !== "cancelled")
    .flatMap(bookingBusyIntervals);
}

function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.start < b.end && a.end > b.start;
}

/** Controleert of een kandidaat-boeking (eigen bezette blokken) botst met bestaande bezette blokken. */
export function hasConflict(
  startIso: string,
  blocks: ServiceBlock[],
  existingBookings: Booking[]
): boolean {
  const baseTime = new Date(startIso).getTime();
  let offset = 0;
  const candidateBusy: Interval[] = [];
  for (const b of blocks) {
    if (b.busy) {
      candidateBusy.push({
        start: baseTime + offset * 60000,
        end: baseTime + (offset + b.durationMinutes) * 60000,
      });
    }
    offset += b.durationMinutes;
  }

  const existingBusy = allBusyIntervals(existingBookings);
  return candidateBusy.some((ci) => existingBusy.some((ei) => intervalsOverlap(ci, ei)));
}

/** Returns array of ISO start-times (strings) available for a given date + dienst-blokken.
 *  Enkel de "bezette" blokken van bestaande afspraken blokkeren nieuwe boekingen — "vrije"
 *  blokken (bv. inwerktijd bij een kleuring) blijven beschikbaar voor andere klanten. */
export function computeAvailableSlots(
  dateStr: string, // "YYYY-MM-DD", Brussels-local
  blocks: ServiceBlock[],
  openingHours: OpeningHours,
  slotStepMinutes: number,
  existingBookings: Booking[]
): string[] {
  const dayOfWeek = new Date(dateStr + "T12:00:00Z").getUTCDay();
  const dayKey = DAY_KEYS[dayOfWeek];
  const ranges: DayHours = openingHours[dayKey] || [];

  if (ranges.length === 0) return [];

  const totalDuration = totalBlocksDuration(blocks);
  const now = new Date();
  const isToday = toBrusselsDateString(now) === dateStr;

  const relevantBookings = existingBookings.filter(
    (b) => b.status !== "cancelled" && toBrusselsDateString(new Date(b.start)) === dateStr
  );
  const existingBusy = allBusyIntervals(relevantBookings);

  const slots: string[] = [];

  for (const range of ranges) {
    const startMin = toMinutes(range.start);
    const endMin = toMinutes(range.end);

    for (let t = startMin; t + totalDuration <= endMin; t += slotStepMinutes) {
      const slotStart = brusselsDateAtMinutes(dateStr, t);

      if (isToday && slotStart.getTime() < now.getTime()) continue;

      let offset = 0;
      const candidateBusy: Interval[] = [];
      for (const b of blocks) {
        if (b.busy) {
          candidateBusy.push({
            start: slotStart.getTime() + offset * 60000,
            end: slotStart.getTime() + (offset + b.durationMinutes) * 60000,
          });
        }
        offset += b.durationMinutes;
      }

      const overlaps = candidateBusy.some((ci) =>
        existingBusy.some((ei) => intervalsOverlap(ci, ei))
      );

      if (!overlaps) {
        slots.push(slotStart.toISOString());
      }
    }
  }

  return slots;
}
