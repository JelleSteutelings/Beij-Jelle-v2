import { NextRequest, NextResponse } from "next/server";
import { mutateDB, genId } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const updates = await req.json();

  const result = await mutateDB((db) => {
    const booking = db.bookings.find((b) => b.id === params.id);
    if (!booking) return { error: "Afspraak niet gevonden" };

    const becomingNoShow = updates.status === "no_show" && booking.status !== "no_show";
    const revertingFromNoShow =
      booking.status === "no_show" && updates.status && updates.status !== "no_show";
    const becomingCancelled = updates.status === "cancelled" && booking.status !== "cancelled";
    const cancelReason = updates.cancelReason as string | undefined;
    const { cancelReason: _omit, ...bookingUpdates } = updates;

    Object.assign(booking, bookingUpdates);

    if (becomingNoShow && booking.customerId) {
      // Blijvend register, los van de afspraak zelf: verwijdert Jelle de
      // afspraak later uit de agenda, dan blijft dit bewijs toch bewaard
      // bij de klant.
      const alreadyLogged = db.noShowRecords.some((r) => r.bookingId === booking.id);
      if (!alreadyLogged) {
        const service = db.services.find((s) => s.id === booking.serviceId);
        db.noShowRecords.push({
          id: genId("ns"),
          customerId: booking.customerId,
          customerName: booking.customerName || "",
          serviceName: service?.name || booking.notes || "Afspraak",
          date: booking.start,
          bookingId: booking.id,
          createdAt: new Date().toISOString(),
        });
      }
    }

    if (revertingFromNoShow) {
      // Vergissing rechtgezet: het bijhorende blijvend record verdwijnt mee.
      db.noShowRecords = db.noShowRecords.filter((r) => r.bookingId !== booking.id);
    }

    if (becomingCancelled) {
      // Ook een blijvend register voor annuleringen — zelfde manier van
      // bijhouden als no-show, maar een heel andere impact: dit tijdstip
      // komt terug vrij en kan aan iemand anders gegeven worden.
      const alreadyLogged = db.cancellationRecords.some((r) => r.bookingId === booking.id);
      if (!alreadyLogged) {
        const service = db.services.find((s) => s.id === booking.serviceId);
        db.cancellationRecords.push({
          id: genId("cn"),
          customerId: booking.customerId || undefined,
          customerName: booking.customerName || "",
          serviceName: service?.name || booking.notes || "Afspraak",
          date: booking.start,
          reason: cancelReason || "",
          bookingId: booking.id,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return { booking };
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result.booking);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  await mutateDB((db) => {
    // De afspraak zelf mag verwijderd worden; het blijvend no-show-register
    // (db.noShowRecords) wordt hier bewust NIET aangeraakt.
    db.bookings = db.bookings.filter((b) => b.id !== params.id);
  });
  return NextResponse.json({ ok: true });
}
