import { NextRequest, NextResponse } from "next/server";
import { verifyAdminPassword } from "@/lib/adminPassword";
import { readDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

/**
 * Controleert het beheerderswachtwoord zonder een nieuwe sessie aan te
 * maken — gebruikt om een gevoelige sectie (bv. het correctielog) extra te
 * beveiligen, bovenop de normale admin-login.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const { password } = await req.json();
  const db = readDB();

  const valid = verifyAdminPassword(password || "", db.settings.adminPasswordHash);
  if (!valid) {
    return NextResponse.json({ error: "Ongeldig wachtwoord" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
