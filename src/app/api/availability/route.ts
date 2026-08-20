import { NextRequest, NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { computeAvailableSlots, getServiceBlocks, totalBlocksDuration } from "@/lib/availability";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("serviceId");
  const date = searchParams.get("date"); // YYYY-MM-DD

  if (!serviceId || !date) {
    return NextResponse.json(
      { error: "serviceId en date zijn verplicht" },
      { status: 400 }
    );
  }

  const db = readDB();
  const service = db.services.find((s) => s.id === serviceId);
  if (!service) {
    return NextResponse.json({ error: "Dienst niet gevonden" }, { status: 404 });
  }

  const blocks = getServiceBlocks(service);
  const slots = computeAvailableSlots(
    date,
    blocks,
    db.settings.openingHours,
    db.settings.slotStepMinutes,
    db.bookings
  );

  return NextResponse.json({ slots, durationMinutes: totalBlocksDuration(blocks) });
}
