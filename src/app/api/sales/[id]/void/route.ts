import { NextRequest, NextResponse } from "next/server";
import { mutateDB, genId } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isDayClosed } from "@/lib/dayClosing";
import { toBrusselsDateString } from "@/lib/tz";

/**
 * Maakt een kassaverrichting volledig ongedaan: de verkoop en de bijhorende
 * afspraak verdwijnen uit de agenda en de dagontvangsten (voorraad- en
 * cadeaubon-effecten worden teruggedraaid).
 *
 * Twee gevallen, afhankelijk van of de dag van de verkoop al definitief
 * afgesloten is (zie `db.dayClosings` / `isDayClosed`):
 * - Nog NIET afgesloten (de "dag file"-fase): dit is gewoon een verkeerd
 *   ingegeven verrichting rechtzetten, geen reden nodig, geen intern
 *   controlespoor — er verandert niets aan de betekenis van de definitieve
 *   dagontvangsten, want die staan nog niet vast.
 * - Al afgesloten: een reden is verplicht en het blijft bewaard in
 *   `db.correctionRecords` (enkel zichtbaar voor de beheerder, geen deel
 *   van rapportages/exports) — zodat er altijd een reden en tijdstip terug
 *   te vinden is voor wat er ná de definitieve afronding nog gewijzigd is.
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

  const result = await mutateDB((db) => {
    const sale = db.sales.find((s) => s.id === params.id);
    if (!sale) return { error: "Verkoop niet gevonden", status: 404 };

    const saleDate = toBrusselsDateString(new Date(sale.createdAt));
    const closed = isDayClosed(db, saleDate);

    if (closed && !reason) {
      return { error: "Geef een reden op voor de correctie.", status: 400 };
    }

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
            note: closed
              ? `Correctie: kassaverrichting ongedaan gemaakt (${reason})`
              : "Kassaverrichting verwijderd (nog niet definitief afgesloten)",
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

    // Intern controlespoor — enkel als het om een al afgesloten dag gaat.
    // Zolang de dag nog niet definitief is, is dit gewoon het rechtzetten
    // van een fout ingegeven verrichting, geen "correctie op vaststaande
    // cijfers".
    if (closed) {
      db.correctionRecords.push({
        id: genId("corr"),
        saleId: sale.id,
        bookingId: sale.bookingId,
        customerId: sale.customerId,
        customerName: sale.customerName,
        serviceName,
        originalTotal: sale.total,
        paymentMethod: sale.paymentMethod,
        reason: reason as string,
        correctedAt: new Date().toISOString(),
      });
    }

    // De verkoop zelf verwijderen — dit is wat ze uit de dagontvangsten haalt.
    db.sales = db.sales.filter((s) => s.id !== sale.id);

    return { ok: true };
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: result.status });
  }
  return NextResponse.json(result);
}
