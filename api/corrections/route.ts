import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const db = readDB();
  return NextResponse.json(
    [...db.correctionRecords].sort(
      (a, b) => new Date(b.correctedAt).getTime() - new Date(a.correctedAt).getTime()
    )
  );
}
