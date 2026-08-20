import { NextRequest, NextResponse } from "next/server";
import { mutateDB, genId } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

type ImportRow = {
  name: string;
  costPrice?: number;
  salePrice?: number;
  quantity?: number; // aantal dat binnenkomt via deze levering
  unit?: string;
};

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json();
  const rows = body.rows as ImportRow[];

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Geen rijen om te importeren" }, { status: 400 });
  }

  const result = await mutateDB((db) => {
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const name = (row.name || "").trim();
      if (!name) continue;

      let product = db.products.find(
        (p) => p.name.trim().toLowerCase() === name.toLowerCase()
      );

      if (!product) {
        product = {
          id: genId("prod"),
          name,
          stock: 0,
          minStock: 1,
          unit: row.unit || "stuks",
          costPrice: row.costPrice,
          salePrice: row.salePrice,
        };
        db.products.push(product);
        created++;
      } else {
        if (row.costPrice !== undefined) product.costPrice = row.costPrice;
        if (row.salePrice !== undefined) product.salePrice = row.salePrice;
        if (row.unit) product.unit = row.unit;
        updated++;
      }

      const quantity = row.quantity || 0;
      if (quantity > 0) {
        product.stock += quantity;
        db.stockMovements.push({
          id: genId("mov"),
          productId: product.id,
          productName: product.name,
          type: "in",
          quantity,
          unitCost: row.costPrice,
          note: "Import leverancier",
          createdAt: new Date().toISOString(),
        });
      }
    }

    return { created, updated };
  });

  return NextResponse.json(result);
}
