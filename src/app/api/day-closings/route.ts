import { NextRequest, NextResponse } from "next/server";
import { mutateDB, readDB, genId } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isDayClosed } from "@/lib/dayClosing";
import { toBrusselsDateString } from "@/lib/tz";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const db = readDB();
  return NextResponse.json(
    [...db.dayClosings].sort((a, b) => (a.closedAt < b.closedAt ? 1 : -1))
  );
}

/** Sluit een dag definitief af: vanaf dit moment kan er niet meer via
 * "Kassa aanpassen" gewijzigd worden en kunnen er geen nieuwe
 * kassaverrichtingen meer bijkomen voor die datum (enkel de
 * wachtwoord-beveiligde correctieflow blijft mogelijk). */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const date = (body.date as string | undefined)?.trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Ongeldige datum." }, { status: 400 });
  }
  const today = toBrusselsDateString(new Date());
  if (date > today) {
    return NextResponse.json(
      { error: "Je kan geen dag in de toekomst afsluiten." },
      { status: 400 }
    );
  }

  const result = await mutateDB((db) => {
    if (isDayClosed(db, date)) {
      return { error: "Deze dag is al afgesloten." };
    }
    const closing = {
      id: genId("dayclose"),
      date,
      closedAt: new Date().toISOString(),
    };
    db.dayClosings.push(closing);
    return { closing };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json(result.closing);
}
