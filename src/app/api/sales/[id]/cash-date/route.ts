import { NextRequest, NextResponse } from "next/server";
import { mutateDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isDayClosed } from "@/lib/dayClosing";
import { toBrusselsDateString } from "@/lib/tz";

/**
 * Wijzigt enkel op welke dag een kassaverrichting getoond wordt in de
 * Cash-dagontvangsten (sale.cashDate) — bv. om ze te verplaatsen naar de dag
 * van de afspraak zelf, als de kassa pas de dag erna werd afgerond.
 *
 * Raakt bewust NIETS anders aan de verkoop aan: het echte afrondingsmoment
 * (createdAt) blijft ongewijzigd en blijft zichtbaar, zodat dit altijd
 * naspeurbaar blijft. cashDate: null verwijdert de overschrijving weer.
 *
 * Zowel de dag waar de verrichting nu staat als de dag waar ze naartoe zou
 * verhuizen moeten nog "open" zijn (zie isDayClosed) — net als bij het
 * gewone aanpassen van een verkoop (PATCH /api/sales/[id]) mag een
 * definitief afgesloten dag niet meer stilzwijgend veranderen.
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
    if (!sale) return { error: "Verkoop niet gevonden", status: 404 };

    const currentDay = sale.cashDate || toBrusselsDateString(new Date(sale.createdAt));
    if (isDayClosed(db, currentDay)) {
      return {
        error:
          "Deze dag is al definitief afgesloten en kan niet meer gewijzigd worden. Heropen de dag eerst bij Cash indien nodig.",
        status: 409,
      };
    }
    if (cashDate != null && isDayClosed(db, cashDate)) {
      return {
        error:
          "De doeldag is al definitief afgesloten. Heropen die dag eerst bij Cash, of verplaats niet.",
        status: 409,
      };
    }

    if (cashDate === null) {
      delete sale.cashDate;
    } else {
      sale.cashDate = cashDate;
    }

    return { sale };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status || 409 });
  }
  return NextResponse.json(result.sale);
}
