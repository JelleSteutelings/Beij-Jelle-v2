import { NextRequest, NextResponse } from "next/server";
import { readDB, mutateDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { validateNewPassword } from "@/lib/adminPassword";

export const dynamic = "force-dynamic";


export async function GET() {
  const db = readDB();
  // Never expose the password hash to the client.
  const { adminPasswordHash, ...safeSettings } = db.settings;
  return NextResponse.json(safeSettings);
}

export async function PATCH(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json();

  const {
    newPassword,
    adminPasswordHash: _ignoredHash, // de hash mag nooit rechtstreeks overschreven worden
    ...rest
  } = body as typeof body & { newPassword?: string; adminPasswordHash?: string };

  if (newPassword !== undefined && newPassword !== "") {
    const pwError = validateNewPassword(newPassword);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }
  }

  const result = await mutateDB((db) => {
    Object.assign(db.settings, rest);

    if (newPassword) {
      db.settings.adminPasswordHash = bcrypt.hashSync(newPassword, 10);
    }
    const { adminPasswordHash, ...safe } = db.settings;
    return safe;
  });

  return NextResponse.json(result);
}
