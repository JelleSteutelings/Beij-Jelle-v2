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
    const product = db.products.find((p) => p.id === params.id);
    if (!product) return { error: "Product niet gevonden" };
    Object.assign(product, updates);
    return { product };
  });
  if ("error" in result) return NextResponse.json(result, { status: 404 });
  return NextResponse.json(result.product);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  await mutateDB((db) => {
    db.products = db.products.filter((p) => p.id !== params.id);
  });
  return NextResponse.json({ ok: true });
}
