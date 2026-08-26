import { NextRequest, NextResponse } from "next/server";
import { mutateDB, genId } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { getServiceBlocks, totalBlocksDuration, buildBookingBlocks } from "@/lib/availability";
import { BookingBlock } from "@/lib/types";

// Admin can create a manual booking or a "blocked" slot directly (bv. voor
// telefonische afspraken of om tijd te blokkeren, bv. verlof).
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json();
  const result = await mutateDB((db) => {
    const startDate = new Date(body.start);
    const endDate = new Date(body.end);
    const requestedDuration = (endDate.getTime() - startDate.getTime()) / 60000;

    let blocks: BookingBlock[] | undefined;
    if (body.serviceId) {
      const service = db.services.find((s) => s.id === body.serviceId);
      if (service) {
        const serviceBlocks = getServiceBlocks(service);
        // Enkel de dienst-blokken (bezet/vrij) toepassen als de duur
        // overeenkomt; heeft de beheerder de duur zelf aangepast in het
        // formulier, dan valt dit terug op één doorlopend bezet blok.
        if (totalBlocksDuration(serviceBlocks) === requestedDuration) {
          blocks = buildBookingBlocks(serviceBlocks);
        }
      }
    }

    const booking = {
      id: genId("bkg"),
      serviceId: body.serviceId || null,
      customerId: body.customerId || null,
      customerName: body.customerName || (body.serviceId ? "" : "Geblokkeerd"),
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      status: body.status || "blocked",
      notes: body.notes || "",
      blocks,
      createdAt: new Date().toISOString(),
    };
    db.bookings.push(booking);
    return booking;
  });
  return NextResponse.json(result);
}
