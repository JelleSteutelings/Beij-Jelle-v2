import { NextRequest, NextResponse } from "next/server";
import { mutateDB, genId } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import {
  getServiceBlocks,
  totalBlocksDuration,
  buildBookingBlocks,
  hasConflict,
  DAY_KEYS,
  toMinutes,
} from "@/lib/availability";
import { brusselsWallTimeToDate } from "@/lib/tz";
import { Booking, RecurringSeries } from "@/lib/types";

/** Nooit meer dan dit aantal afspraken in één keer aanmaken — een
 * ruime, praktische bovengrens (bv. wekelijks bijna een jaar vooruit),
 * puur als bescherming tegen een verkeerd ingevulde einddatum die anders
 * duizenden afspraken zou genereren. */
const MAX_OCCURRENCES = 52;

/** Telkens `weeks` weken bij een "YYYY-MM-DD"-datum optellen, op de
 * kalenderdag zelf gerekend (niet via ruwe ms-optelling op een ISO-
 * tijdstip) — net als elders in de app, om DST-verschuivingen rond de
 * over-/wintertijd te vermijden. */
function addWeeksToDateStr(dateStr: string, weeks: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

/** Dag-van-de-week ("mon", "tue", ...) van een "YYYY-MM-DD"-datum,
 * tijdzone-onafhankelijk bepaald (net als in availability.ts). */
function dayKeyOf(dateStr: string) {
  const dayOfWeek = new Date(dateStr + "T12:00:00Z").getUTCDay();
  return DAY_KEYS[dayOfWeek];
}

/**
 * Maakt een reeks terugkerende afspraken aan (wekelijks, om de 2/3/4
 * weken...) voor dezelfde klant, dienst en tijdstip. Genereert meteen alle
 * individuele Booking-records (geen achtergrondtaak nodig) en slaat
 * datums over die niet kunnen — gesloten dag/tijdstip buiten de
 * openingsuren, of een botsing met een bestaande afspraak/blokkering
 * (vakantie inplannen maakt zulke blokkerende afspraken aan, dus dat wordt
 * hier automatisch mee opgevangen). Geeft achteraf een volledig overzicht
 * terug van wat er aangemaakt is en wat er overgeslagen is (en waarom).
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));

  const serviceId = (body.serviceId as string | undefined) || "";
  const customerId = (body.customerId as string | null | undefined) || null;
  const customerName = ((body.customerName as string | undefined) || "").trim();
  const notes = (body.notes as string | undefined) || "";
  const firstDate = (body.firstDate as string | undefined) || "";
  const time = (body.time as string | undefined) || "";
  const intervalWeeks = Number(body.intervalWeeks);
  const endType = body.endType as "count" | "until" | undefined;
  const rawCount = Number(body.count);
  const untilDate = (body.untilDate as string | undefined) || "";

  if (!serviceId) {
    return NextResponse.json({ error: "Kies een dienst." }, { status: 400 });
  }
  if (!customerName) {
    return NextResponse.json({ error: "Kies een klant." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDate)) {
    return NextResponse.json({ error: "Ongeldige startdatum." }, { status: 400 });
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json({ error: "Ongeldig tijdstip." }, { status: 400 });
  }
  if (![1, 2, 3, 4].includes(intervalWeeks)) {
    return NextResponse.json(
      { error: "Kies wekelijks, of om de 2, 3 of 4 weken." },
      { status: 400 }
    );
  }

  // Alle geldige datums (nog vóór conflicten/gesloten dagen) bepalen.
  const dates: string[] = [];
  if (endType === "count") {
    const n = Math.min(Math.max(1, Math.floor(rawCount) || 0), MAX_OCCURRENCES);
    if (n < 1) {
      return NextResponse.json({ error: "Geef een geldig aantal keer op." }, { status: 400 });
    }
    for (let i = 0; i < n; i++) dates.push(addWeeksToDateStr(firstDate, i * intervalWeeks));
  } else if (endType === "until") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(untilDate) || untilDate < firstDate) {
      return NextResponse.json(
        { error: "Kies een einddatum die na de startdatum ligt." },
        { status: 400 }
      );
    }
    let i = 0;
    while (dates.length < MAX_OCCURRENCES) {
      const d = addWeeksToDateStr(firstDate, i * intervalWeeks);
      if (d > untilDate) break;
      dates.push(d);
      i++;
    }
    if (dates.length === 0) {
      return NextResponse.json(
        { error: "Geen enkele datum valt binnen deze periode." },
        { status: 400 }
      );
    }
  } else {
    return NextResponse.json({ error: "Kies een einde voor de reeks." }, { status: 400 });
  }

  const result = await mutateDB((db) => {
    const service = db.services.find((s) => s.id === serviceId);
    if (!service) {
      return { error: "Deze dienst bestaat niet (meer).", status: 400 as const };
    }
    const serviceBlocks = getServiceBlocks(service);
    const totalDuration = totalBlocksDuration(serviceBlocks);
    const startMin = toMinutes(time);
    const endMin = startMin + totalDuration;

    const seriesId = genId("series");
    const series: RecurringSeries = {
      id: seriesId,
      customerId,
      customerName,
      serviceId,
      intervalWeeks,
      time,
      notes,
      createdAt: new Date().toISOString(),
    };

    const created: Booking[] = [];
    const skipped: { date: string; reason: string }[] = [];

    for (const dateStr of dates) {
      const ranges = db.settings.openingHours[dayKeyOf(dateStr)] || [];
      const withinHours = ranges.some(
        (r) => toMinutes(r.start) <= startMin && endMin <= toMinutes(r.end)
      );
      if (!withinHours) {
        skipped.push({ date: dateStr, reason: "salon gesloten op dit tijdstip" });
        continue;
      }

      const startDate = brusselsWallTimeToDate(dateStr, time);
      const startIso = startDate.toISOString();
      const endIso = new Date(startDate.getTime() + totalDuration * 60000).toISOString();

      if (hasConflict(startIso, serviceBlocks, db.bookings)) {
        skipped.push({ date: dateStr, reason: "tijdstip is al bezet" });
        continue;
      }

      const booking: Booking = {
        id: genId("bkg"),
        serviceId,
        customerId,
        customerName,
        start: startIso,
        end: endIso,
        status: "confirmed",
        notes,
        blocks: buildBookingBlocks(serviceBlocks),
        seriesId,
        createdAt: new Date().toISOString(),
      };
      db.bookings.push(booking);
      created.push(booking);
    }

    // De reeks zelf bewaren we ook als er uiteindelijk niets aangemaakt kon
    // worden — dan is er tenminste nog een spoor van de poging, en blijft
    // de UI eenvoudig (altijd een series-object terugkrijgen).
    db.recurringSeries.push(series);

    return { series, created, skipped };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
