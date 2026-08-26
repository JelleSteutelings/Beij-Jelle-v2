import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const db = readDB();
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `beij-jelle-backup-${dateStr}.json`;

  return new NextResponse(JSON.stringify(db, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
