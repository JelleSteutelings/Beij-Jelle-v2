import { NextRequest, NextResponse } from "next/server";
import { mutateDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const updates = await req.json();
  const result = await mutateDB((db) => {
    const voucher = db.giftVouchers.find((v) => v.id === params.id);
    if (!voucher) return { error: "Cadeaubon niet gevonden" };
    Object.assign(voucher, updates);
    return { voucher };
  });
  if ("error" in result) return NextResponse.json(result, { status: 404 });
  return NextResponse.json(result.voucher);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  await mutateDB((db) => {
    db.giftVouchers = db.giftVouchers.filter((v) => v.id !== params.id);
  });
  return NextResponse.json({ ok: true });
}
