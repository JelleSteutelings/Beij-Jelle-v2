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

  const result = await mutateDB((db) => {
    const movement = db.stockMovements.find((m) => m.id === params.id);
    if (!movement) return { error: "Beweging niet gevonden" };

    // Effect op de voorraad terugdraaien: "in" telde erbij op, dus eraf;
    // "sold"/"used" telde eraf, dus terug erbij.
    const product = db.products.find((p) => p.id === movement.productId);
    if (product) {
      if (movement.type === "in") {
        product.stock = Math.max(0, product.stock - movement.quantity);
      } else {
        product.stock += movement.quantity;
      }
    }

    db.stockMovements = db.stockMovements.filter((m) => m.id !== params.id);
    return { ok: true };
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result);
}
