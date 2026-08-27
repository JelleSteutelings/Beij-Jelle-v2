import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { mutateDB, readDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { DB } from "@/lib/types";

/**
 * Lijsten die via dit scherm gewist mogen worden — bewust een expliciete
 * whitelist (niet zomaar elke sleutel uit de DB), zodat "diensten",
 * "producten", "klanten" en "settings" hier nooit per ongeluk in terecht
 * kunnen komen, ook niet via een aangepast verzoek.
 */
const RESETTABLE_KEYS = [
  "bookings",
  "cancellationRecords",
  "noShowRecords",
  "sales",
  "dayClosings",
  "correctionRecords",
  "giftVouchers",
  "purchaseOrders",
  "stockMovements",
] as const;

type ResettableKey = (typeof RESETTABLE_KEYS)[number];

function isResettableKey(k: string): k is ResettableKey {
  return (RESETTABLE_KEYS as readonly string[]).includes(k);
}

function countFor(db: DB, key: ResettableKey): number {
  return (db[key] as unknown[]).length;
}

/** Huidige aantallen per wisbare lijst, om in de UI te tonen vóór er iets
 * effectief verwijderd wordt. Geen wachtwoord nodig om enkel de aantallen
 * te zien (geen gevoelige inhoud, enkel tellingen), wel om in te loggen —
 * dat wordt al afgedwongen door de /admin middleware. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const db = readDB();
  const counts = Object.fromEntries(
    RESETTABLE_KEYS.map((k) => [k, countFor(db, k)])
  );
  return NextResponse.json({ counts });
}

/**
 * Wist enkel de expliciet gekozen lijsten volledig leeg. Diensten (incl.
 * prijzen), producten/voorraad-aantallen, klanten en instellingen worden
 * hier nooit aangeraakt — ook niet onrechtstreeks — net omdat dit
 * eindpunt bedoeld is om vlak vóór de livegang test-agenda en
 * test-financiële-gegevens weg te gooien zonder de rest kwijt te raken.
 * Achter dezelfde extra wachtwoordcontrole als Correcties/dag heropenen,
 * plus een letterlijk te typen bevestiging — dit is niet ongedaan te
 * maken.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const password = (body.password as string | undefined) || "";
  const confirm = (body.confirm as string | undefined) || "";
  const lists = Array.isArray(body.lists) ? (body.lists as string[]) : [];

  if (confirm.trim().toUpperCase() !== "VERWIJDER") {
    return NextResponse.json(
      { error: 'Typ precies "VERWIJDER" ter bevestiging.' },
      { status: 400 }
    );
  }
  if (lists.length === 0) {
    return NextResponse.json(
      { error: "Kies minstens één lijst om te wissen." },
      { status: 400 }
    );
  }
  const invalid = lists.filter((l) => !isResettableKey(l));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Ongeldige lijst(en): ${invalid.join(", ")}` },
      { status: 400 }
    );
  }
  const keys = lists.filter(isResettableKey);

  const result = await mutateDB((db) => {
    const valid = bcrypt.compareSync(password, db.settings.adminPasswordHash);
    if (!valid) {
      return { error: "Ongeldig wachtwoord", status: 401 as const };
    }
    const deleted: Record<string, number> = {};
    for (const key of keys) {
      deleted[key] = countFor(db, key);
      (db[key] as unknown[]) = [];
    }
    return { deleted };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ deleted: result.deleted });
}
