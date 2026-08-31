import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

/** Lijst van alle terugkerende reeksen — enkel gebruikt om in de agenda te
 * tonen dat een afspraak deel uitmaakt van een reeks (en aan welk
 * interval), niet om zelf plannings-logica op te draaien. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const db = readDB();
  return NextResponse.json(db.recurringSeries);
}
