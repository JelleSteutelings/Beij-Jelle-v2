import { NextRequest, NextResponse } from "next/server";
import { mutateDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { PurchaseOrderItem } from "@/lib/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json();
  const { supplier, items, notes } = body as {
    supplier?: string;
    items?: PurchaseOrderItem[];
    notes?: string;
  };

  const result = await mutateDB((db) => {
    const order = db.purchaseOrders.find((o) => o.id === params.id);
    if (!order) return { error: "Bestelling niet gevonden" };
    if (order.status !== "besteld") {
      return { error: "Enkel een nog openstaande bestelling kan aangepast worden." };
    }
    if (supplier !== undefined) order.supplier = supplier.trim() || undefined;
    if (items !== undefined) order.items = items;
    if (notes !== undefined) order.notes = notes.trim() || undefined;
    return { order };
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: 409 });
  }
  return NextResponse.json(result.order);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const result = await mutateDB((db) => {
    const order = db.purchaseOrders.find((o) => o.id === params.id);
    if (!order) return { error: "Bestelling niet gevonden" };
    if (order.status === "ontvangen") {
      return {
        error:
          "Een ontvangen bestelling kan niet verwijderd worden — de voorraad en kosten zijn al verwerkt.",
      };
    }
    db.purchaseOrders = db.purchaseOrders.filter((o) => o.id !== params.id);
    return { ok: true };
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: 409 });
  }
  return NextResponse.json(result);
}
