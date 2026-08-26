import { NextRequest, NextResponse } from "next/server";
import { mutateDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

/**
 * Wijzigt enkel op welke dag een kassaverrichting getoond wordt in de
 * Cash-dagontvangsten (sale.cashDate) — bv. om ze te verplaatsen naar de dag
 * van de afspraak zelf, als de kassa pas de dag erna werd afgerond.
 *
 * Raakt bewust NIETS anders aan de verkoop aan: het echte afrondingsmoment
 * (createdAt) blijft ongewijzigd en blijft zichtbaar, zodat dit altijd
 * naspeurbaar blijft. cashDate: null verwijdert de overschrijving weer.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const cashDate = body.cashDate as string | null | undefined;

  if (cashDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(cashDate || "")) {
    return NextResponse.json({ error: "Ongeldige datum." }, { status: 400 });
  }

  const result = await mutateDB((db) => {
    const sale = db.sales.find((s) => s.id === params.id);
    if (!sale) return { error: "Verkoop niet gevonden" };

    if (cashDate === null) {
      delete sale.cashDate;
    } else {
      sale.cashDate = cashDate;
    }

    return { sale };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json(result.sale);
}
