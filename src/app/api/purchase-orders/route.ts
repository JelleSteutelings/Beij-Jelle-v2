import { NextRequest, NextResponse } from "next/server";
import { readDB, mutateDB, genId } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { PurchaseOrderItem } from "@/lib/types";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const db = readDB();
  return NextResponse.json(
    [...db.purchaseOrders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  );
}

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json();
  const { supplier, items, notes } = body as {
    supplier?: string;
    items: PurchaseOrderItem[];
    notes?: string;
  };

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Voeg minstens één item toe." }, { status: 400 });
  }

  const result = await mutateDB((db) => {
    const order = {
      id: genId("po"),
      supplier: supplier?.trim() || undefined,
      items,
      status: "besteld" as const,
      notes: notes?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    db.purchaseOrders.push(order);
    return order;
  });

  return NextResponse.json(result);
}
