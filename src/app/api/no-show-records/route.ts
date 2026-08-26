import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const db = readDB();
  return NextResponse.json(
    [...db.noShowRecords].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  );
}
