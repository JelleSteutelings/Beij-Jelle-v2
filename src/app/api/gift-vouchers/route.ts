import { NextRequest, NextResponse } from "next/server";
import { readDB, mutateDB, genId } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const db = readDB();
  return NextResponse.json(
    [...db.giftVouchers].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  );
}

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json();
  const { code, amount, customerId, customerName, note, issuedAt, origin } = body as {
    code: string;
    amount: number;
    customerId?: string;
    customerName?: string;
    note?: string;
    issuedAt?: string;
    origin?: "paid" | "sponsoring";
  };

  if (!code?.trim() || !amount || amount <= 0) {
    return NextResponse.json(
      { error: "Geef een code en een bedrag groter dan 0 op." },
      { status: 400 }
    );
  }

  const result = await mutateDB((db) => {
    const exists = db.giftVouchers.find(
      (v) => v.code.trim().toLowerCase() === code.trim().toLowerCase()
    );
    if (exists) return { error: "Er bestaat al een cadeaubon met deze code." };

    const voucher = {
      id: genId("gv"),
      code: code.trim(),
      originalAmount: amount,
      remainingAmount: amount,
      origin: origin === "sponsoring" ? "sponsoring" : ("paid" as "paid" | "sponsoring"),
      customerId: customerId || undefined,
      customerName: customerName || undefined,
      note: note || "",
      issuedAt: issuedAt || new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.giftVouchers.push(voucher);
    return { voucher };
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: 409 });
  }
  return NextResponse.json(result.voucher);
}
