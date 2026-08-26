import { NextRequest, NextResponse } from "next/server";
import { mutateDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const { orderedIds } = await req.json();
  if (!Array.isArray(orderedIds)) {
    return NextResponse.json({ error: "orderedIds ontbreekt" }, { status: 400 });
  }

  await mutateDB((db) => {
    orderedIds.forEach((id: string, index: number) => {
      const product = db.products.find((p) => p.id === id);
      if (product) product.order = index;
    });
  });

  return NextResponse.json({ ok: true });
}
