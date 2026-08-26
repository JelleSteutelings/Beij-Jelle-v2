import { NextRequest, NextResponse } from "next/server";
import { mutateDB, readDB, genId } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { StockMovementType } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const db = readDB();
  const movements = db.stockMovements
    .filter((m) => m.productId === params.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return NextResponse.json(movements);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json();
  const { type, quantity, unitCost, unitPrice, note } = body as {
    type: StockMovementType;
    quantity: number;
    unitCost?: number;
    unitPrice?: number;
    note?: string;
  };

  if (!type || !quantity || quantity <= 0) {
    return NextResponse.json(
      { error: "Geef een type en een aantal groter dan 0 op." },
      { status: 400 }
    );
  }

  const result = await mutateDB((db) => {
    const product = db.products.find((p) => p.id === params.id);
    if (!product) return { error: "Product niet gevonden" };

    if (type === "in") {
      product.stock += quantity;
      if (unitCost !== undefined) product.costPrice = unitCost;
    } else {
      product.stock = Math.max(0, product.stock - quantity);
    }

    const movement = {
      id: genId("mov"),
      productId: product.id,
      productName: product.name,
      type,
      quantity,
      unitCost: type === "in" ? unitCost : undefined,
      unitPrice: type === "sold" ? unitPrice : undefined,
      note: note || "",
      createdAt: new Date().toISOString(),
    };
    db.stockMovements.push(movement);
    return { movement, product };
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result);
}
