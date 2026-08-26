import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { mutateDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { isDayClosed } from "@/lib/dayClosing";

/** Heropent een per ongeluk (te vroeg) afgesloten dag. Achter dezelfde
 * extra wachtwoordcontrole als bij Correcties, en een verplichte reden —
 * blijft zichtbaar in de geschiedenis (het oude afsluit-record wordt
 * gemarkeerd met reopenedAt/reopenReason, niet verwijderd). */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const date = (body.date as string | undefined)?.trim();
  const password = (body.password as string | undefined) || "";
  const reason = (body.reason as string | undefined)?.trim();

  if (!date) {
    return NextResponse.json({ error: "Ongeldige datum." }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json(
      { error: "Geef een reden op voor het heropenen." },
      { status: 400 }
    );
  }

  const result = await mutateDB((db) => {
    const valid = bcrypt.compareSync(password, db.settings.adminPasswordHash);
    if (!valid) {
      return { error: "Ongeldig wachtwoord", status: 401 };
    }
    if (!isDayClosed(db, date)) {
      return { error: "Deze dag is niet afgesloten.", status: 409 };
    }
    const records = db.dayClosings.filter((c) => c.date === date);
    const latest = records.reduce((a, b) => (a.closedAt > b.closedAt ? a : b));
    latest.reopenedAt = new Date().toISOString();
    latest.reopenReason = reason;
    return { closing: latest };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.closing);
}
