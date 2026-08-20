import { NextRequest, NextResponse } from "next/server";
import { mutateDB, genId } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

/**
 * Rondt een openstaande bestelling af: voor elk item wordt de voorraad
 * verhoogd (een nog onbekend product wordt automatisch aangemaakt) en een
 * "in"-voorraadbeweging gelogd met de aankoopprijs, zodat de bestelling
 * mee in de stock én de kostenoverzichten terechtkomt.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const result = await mutateDB((db) => {
    const order = db.purchaseOrders.find((o) => o.id === params.id);
    if (!order) return { error: "Bestelling niet gevonden" };
    if (order.status !== "besteld") {
      return { error: "Deze bestelling is al afgerond of geannuleerd." };
    }

    const receivedAt = new Date().toISOString();

    for (const item of order.items) {
      let product = item.productId
        ? db.products.find((p) => p.id === item.productId)
        : db.products.find(
            (p) => p.name.toLowerCase() === item.productName.trim().toLowerCase()
          );

      if (!product) {
        const maxOrder = db.products.reduce((m, p) => Math.max(m, p.order ?? 0), -1);
        product = {
          id: genId("prod"),
          name: item.productName.trim(),
          stock: 0,
          minStock: 1,
          unit: "stuks",
          costPrice: item.unitCost,
          order: maxOrder + 1,
        };
        db.products.push(product);
      }

      product.stock += item.quantity;
      if (item.unitCost !== undefined) product.costPrice = item.unitCost;

      db.stockMovements.push({
        id: genId("mov"),
        productId: product.id,
        productName: product.name,
        type: "in",
        quantity: item.quantity,
        unitCost: item.unitCost,
        note: `Bestelling ontvangen${order.supplier ? ` (${order.supplier})` : ""}`,
        createdAt: receivedAt,
      });
    }

    order.status = "ontvangen";
    order.receivedAt = receivedAt;
    return { order };
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: 409 });
  }
  return NextResponse.json(result.order);
}
