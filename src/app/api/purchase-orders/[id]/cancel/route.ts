import { NextRequest, NextResponse } from "next/server";
import { mutateDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

/**
 * Annuleert een openstaande bestelling die uiteindelijk niet ontvangen werd
 * (verkeerd besteld, leverancier annuleerde, ...). Blijft zichtbaar in de
 * bestellingenlijst mét reden — dit is niet bedoeld voor bestellingen die
 * wél binnenkwamen (zie /receive daarvoor).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const reason = (body.reason as string | undefined)?.trim();
  if (!reason) {
    return NextResponse.json(
      { error: "Geef een reden op voor de annulering." },
      { status: 400 }
    );
  }

  const result = await mutateDB((db) => {
    const order = db.purchaseOrders.find((o) => o.id === params.id);
    if (!order) return { error: "Bestelling niet gevonden" };
    if (order.status !== "besteld") {
      return { error: "Deze bestelling is al afgerond of geannuleerd." };
    }
    order.status = "geannuleerd";
    order.cancelledAt = new Date().toISOString();
    order.cancelReason = reason;
    return { order };
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: 409 });
  }
  return NextResponse.json(result.order);
}
