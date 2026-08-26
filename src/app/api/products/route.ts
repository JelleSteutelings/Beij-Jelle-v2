import { NextRequest, NextResponse } from "next/server";
import { readDB, mutateDB, genId } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const db = readDB();
  const sorted = [...db.products].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return NextResponse.json(sorted);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json();
  const product = await mutateDB((db) => {
    const maxOrder = db.products.reduce((max, p) => Math.max(max, p.order ?? 0), -1);
    const p = {
      id: genId("prod"),
      name: body.name,
      stock: Number(body.stock) || 0,
      minStock: Number(body.minStock) || 0,
      unit: body.unit || "stuks",
      costPrice: body.costPrice !== undefined && body.costPrice !== "" ? Number(body.costPrice) : undefined,
      salePrice: body.salePrice !== undefined && body.salePrice !== "" ? Number(body.salePrice) : undefined,
      order: maxOrder + 1,
    };
    db.products.push(p);
    return p;
  });
  return NextResponse.json(product);
}
