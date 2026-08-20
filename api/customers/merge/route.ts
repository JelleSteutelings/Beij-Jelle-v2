import { NextRequest, NextResponse } from "next/server";
import { mutateDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const { primaryId, duplicateId } = await req.json();

  if (!primaryId || !duplicateId || primaryId === duplicateId) {
    return NextResponse.json(
      { error: "Kies twee verschillende klanten." },
      { status: 400 }
    );
  }

  const result = await mutateDB((db) => {
    const primary = db.customers.find((c) => c.id === primaryId);
    const duplicate = db.customers.find((c) => c.id === duplicateId);
    if (!primary || !duplicate) {
      return { error: "Eén van beide klanten werd niet gevonden." };
    }

    let movedBookings = 0;
    let movedSales = 0;
    let movedVouchers = 0;
    let movedNoShows = 0;

    for (const b of db.bookings) {
      if (b.customerId === duplicateId) {
        b.customerId = primaryId;
        b.customerName = primary.name;
        movedBookings++;
      }
    }

    for (const s of db.sales) {
      if (s.customerId === duplicateId) {
        s.customerId = primaryId;
        movedSales++;
      }
    }

    for (const v of db.giftVouchers) {
      if (v.customerId === duplicateId) {
        v.customerId = primaryId;
        v.customerName = primary.name;
        movedVouchers++;
      }
    }

    for (const r of db.noShowRecords) {
      if (r.customerId === duplicateId) {
        r.customerId = primaryId;
        r.customerName = primary.name;
        movedNoShows++;
      }
    }

    // Gaten in de correcte klant aanvullen met gegevens van de dubbel,
    // zonder al ingevulde gegevens van de correcte klant te overschrijven.
    if (!primary.email && duplicate.email) primary.email = duplicate.email;
    if (!primary.address && duplicate.address) primary.address = duplicate.address;
    if (!primary.notes && duplicate.notes) primary.notes = duplicate.notes;

    db.customers = db.customers.filter((c) => c.id !== duplicateId);

    return {
      primary,
      movedBookings,
      movedSales,
      movedVouchers,
      movedNoShows,
    };
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result);
}
