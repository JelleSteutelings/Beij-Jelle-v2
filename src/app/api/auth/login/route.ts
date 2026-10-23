import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { readDB, mutateDB } from "@/lib/db";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getSessionSecret } from "@/lib/session-secret";
import {
  verifyAdminPassword,
  needsInitialPassword,
  getInitialPassword,
  safeEqual,
} from "@/lib/adminPassword";

export async function POST(req: NextRequest) {
  const secret = getSessionSecret();
  if (!secret.ok) {
    return NextResponse.json(
      {
        error:
          "Inloggen is geblokkeerd: de server is niet volledig ingesteld (SESSION_SECRET). Neem contact op met de beheerder van de website.",
      },
      { status: 503 }
    );
  }

  let password: unknown;
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Ongeldig wachtwoord" }, { status: 401 });
  }
  const db = readDB();

  let valid = false;
  if (needsInitialPassword(db.settings.adminPasswordHash)) {
    // Nog geen eigen wachtwoord ingesteld (nieuwe installatie, of nog het
    // oude standaardwachtwoord). Inloggen kan enkel met het startwachtwoord
    // uit de omgevingsvariabele ADMIN_INITIAL_PASSWORD; dat wordt meteen het
    // echte (gehashte) wachtwoord.
    const initial = getInitialPassword();
    if (!initial) {
      console.error(
        "[beveiliging] Er is nog geen beheerderswachtwoord. Zet ADMIN_INITIAL_PASSWORD (minstens 10 tekens) als omgevingsvariabele en probeer opnieuw."
      );
    } else if (typeof password === "string" && safeEqual(password, initial)) {
      valid = true;
      await mutateDB((d) => {
        d.settings.adminPasswordHash = bcrypt.hashSync(initial, 10);
      });
    }
  } else {
    valid = verifyAdminPassword(password, db.settings.adminPasswordHash);
  }

  if (!valid) {
    return NextResponse.json({ error: "Ongeldig wachtwoord" }, { status: 401 });
  }

  const token = await signSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
