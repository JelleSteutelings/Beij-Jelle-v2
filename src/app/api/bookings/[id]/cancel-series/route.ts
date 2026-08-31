import { NextRequest, NextResponse } from "next/server";
import { mutateDB, genId } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

/**
 * Annuleert meerdere afspraken uit dezelfde terugkerende reeks in één
 * keer — "scope" bepaalt hoeveel: enkel deze ene afspraak hoort hier
 * eigenlijk niet thuis (dat gaat via de gewone PATCH .../bookings/[id]),
 * "following" = deze en alle latere afspraken uit de reeks, "series" = de
 * volledige reeks (ook eerdere, indien nog niet afgerond/geannuleerd).
 * Enkel afspraken met status "confirmed" of "pending" worden aangepast —
 * afgeronde (met een kassaverrichting) of al geannuleerde/no-show
 * afspraken blijven ongemoeid, net zoals bij een gewone annulering.
 * Per geannuleerde afspraak komt er, zoals gebruikelijk, een
 * cancellationRecords-item bij.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const scope = body.scope as "following" | "series" | undefined;
  const reason = (body.reason as string | undefined) || "";

  if (scope !== "following" && scope !== "series") {
    return NextResponse.json({ error: "Ongeldige scope." }, { status: 400 });
  }

  const result = await mutateDB((db) => {
    const anchor = db.bookings.find((b) => b.id === params.id);
    if (!anchor) return { error: "Afspraak niet gevonden.", status: 404 as const };
    if (!anchor.seriesId) {
      return { error: "Deze afspraak maakt geen deel uit van een reeks.", status: 400 as const };
    }

    const targets = db.bookings.filter((b) => {
      if (b.seriesId !== anchor.seriesId) return false;
      if (b.status !== "confirmed" && b.status !== "pending") return false;
      if (scope === "following") return b.start >= anchor.start;
      return true; // "series"
    });

    let cancelled = 0;
    for (const booking of targets) {
      booking.status = "cancelled";
      cancelled++;
      const alreadyLogged = db.cancellationRecords.some((r) => r.bookingId === booking.id);
      if (!alreadyLogged) {
        const service = db.services.find((s) => s.id === booking.serviceId);
        db.cancellationRecords.push({
          id: genId("cn"),
          customerId: booking.customerId || undefined,
          customerName: booking.customerName || "",
          serviceName: service?.name || booking.notes || "Afspraak",
          date: booking.start,
          reason,
          bookingId: booking.id,
          createdAt: new Date().toISOString(),
        });
      }
    }

    const series = db.recurringSeries.find((s) => s.id === anchor.seriesId);
    if (series && !series.endedAt) {
      series.endedAt = new Date().toISOString();
    }

    return { cancelled };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
