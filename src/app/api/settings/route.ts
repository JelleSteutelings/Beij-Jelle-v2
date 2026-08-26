import { NextRequest, NextResponse } from "next/server";
import { readDB, mutateDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import bcrypt from "bcryptjs";

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

  const result = await mutateDB((db) => {
    const {
      newPassword,
      ...rest
    } = body as typeof body & { newPassword?: string };

    Object.assign(db.settings, rest);

    if (newPassword && newPassword.length >= 6) {
      db.settings.adminPasswordHash = bcrypt.hashSync(newPassword, 10);
    }
    const { adminPasswordHash, ...safe } = db.settings;
    return safe;
  });

  return NextResponse.json(result);
}
