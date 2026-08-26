import { NextRequest, NextResponse } from "next/server";
import { mutateDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  await mutateDB((db) => {
    db.noShowRecords = db.noShowRecords.filter((r) => r.id !== params.id);
  });
  return NextResponse.json({ ok: true });
}
