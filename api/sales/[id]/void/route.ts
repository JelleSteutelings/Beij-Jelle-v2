import { NextRequest, NextResponse } from "next/server";
import { mutateDB, genId } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

/**
 * Maakt een afgeronde kassaverrichting volledig ongedaan: de verkoop en de
 * bijhorende afspraak verdwijnen uit de agenda en de dagontvangsten
 * (voorraad- en cadeaubon-effecten worden teruggedraaid). Er blijft wel een
 * intern controlespoor bewaard (db.correctionRecords) — enkel zichtbaar
 * voor de beheerder, geen deel van rapportages of exports — zodat er altijd
 * een reden en tijdstip terug te vinden is voor wie corrigeerde.
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
      { error: "Geef een reden op voor de correctie." },
      { status: 400 }
    );
  }

  const result = await mutateDB((db) => {
    const sale = db.sales.find((s) => s.id === params.id);
    if (!sale) return { error: "Verkoop niet gevonden" };

    // Voorraad terugdraaien voor productitems (het spiegelbeeld van wat
    // /api/sales bij het afronden deed).
    for (const item of sale.items) {
      if (item.type === "product") {
        const product = db.products.find((p) => p.id === item.refId);
        if (product) {
          product.stock += item.qty;
          db.stockMovements.push({
            id: genId("mov"),
            productId: product.id,
            productName: product.name,
            type: "in",
            quantity: item.qty,
            note: `Correctie: kassaverrichting ongedaan gemaakt (${reason})`,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // Cadeaubon-afboeking terugdraaien, indien van toepassing.
    if (sale.giftVoucherId && sale.giftVoucherAmountUsed) {
      const voucher = db.giftVouchers.find((v) => v.id === sale.giftVoucherId);
      if (voucher) {
        voucher.remainingAmount =
          Math.round((voucher.remainingAmount + sale.giftVoucherAmountUsed) * 100) / 100;
      }
    }

    // Bijhorende afspraak volledig uit de agenda halen (indien nog aanwezig).
    let serviceName: string | undefined;
    if (sale.bookingId) {
      const booking = db.bookings.find((b) => b.id === sale.bookingId);
      if (booking) {
        const service = db.services.find((s) => s.id === booking.serviceId);
        serviceName = service?.name || booking.notes || undefined;
      }
      db.bookings = db.bookings.filter((b) => b.id !== sale.bookingId);
    }

    // Intern controlespoor, los van de dagontvangsten.
    db.correctionRecords.push({
      id: genId("corr"),
      saleId: sale.id,
      bookingId: sale.bookingId,
      customerId: sale.customerId,
      customerName: sale.customerName,
      serviceName,
      originalTotal: sale.total,
      paymentMethod: sale.paymentMethod,
      reason,
      correctedAt: new Date().toISOString(),
    });

    // De verkoop zelf verwijderen — dit is wat ze uit de dagontvangsten haalt.
    db.sales = db.sales.filter((s) => s.id !== sale.id);

    return { ok: true };
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result);
}
