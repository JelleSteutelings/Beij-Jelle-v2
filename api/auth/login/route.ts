import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { readDB } from "@/lib/db";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const db = readDB();

  const valid = bcrypt.compareSync(password || "", db.settings.adminPasswordHash);
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
