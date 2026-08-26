import { NextRequest, NextResponse } from "next/server";
import { readDB, mutateDB, genId } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { SaleItem, SalePaymentMethod } from "@/lib/types";

export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const db = readDB();
  return NextResponse.json(
    [...db.sales].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  );
}

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json();
  const {
    bookingId,
    customerId,
    customerName,
    items,
    paymentMethod,
    giftVoucherId,
    giftVoucherAmountUsed,
    totalOverride,
    studentDiscount,
  } = body as {
    bookingId?: string;
    customerId?: string;
    customerName?: string;
    items: SaleItem[];
    paymentMethod: SalePaymentMethod;
    giftVoucherId?: string;
    giftVoucherAmountUsed?: number;
    totalOverride?: number;
    studentDiscount?: boolean;
  };

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Geen items opgegeven" }, { status: 400 });
  }

  const result = await mutateDB((db) => {
    const itemsTotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const total =
      totalOverride !== undefined && totalOverride >= 0
        ? Math.round(totalOverride * 100) / 100
        : itemsTotal;

    let voucherAmount = 0;
    let voucher = null;
    if (giftVoucherId && giftVoucherAmountUsed && giftVoucherAmountUsed > 0) {
      voucher = db.giftVouchers.find((v) => v.id === giftVoucherId);
      if (!voucher) return { error: "Cadeaubon niet gevonden." };
      if (giftVoucherAmountUsed > voucher.remainingAmount) {
        return { error: "Dit bedrag overschrijdt het resterend saldo van de cadeaubon." };
      }
      if (giftVoucherAmountUsed > total) {
        return { error: "Het cadeaubon-bedrag kan niet hoger zijn dan het totaal." };
      }
      voucherAmount = giftVoucherAmountUsed;
      voucher.remainingAmount = Math.round((voucher.remainingAmount - voucherAmount) * 100) / 100;
    }

    // Naam bepalen: rechtstreeks opgegeven (bv. losse verkoop zonder
    // afspraak/klant), anders via een gekoppeld klantprofiel, anders via de
    // naam die op de afspraak zelf stond — zo tonen kassaverrichtingen
    // altijd een naam.
    let resolvedCustomerName: string | undefined = customerName?.trim() || undefined;
    if (!resolvedCustomerName && customerId) {
      resolvedCustomerName = db.customers.find((c) => c.id === customerId)?.name;
    }
    if (!resolvedCustomerName && bookingId) {
      resolvedCustomerName = db.bookings.find((b) => b.id === bookingId)?.customerName;
    }

    const newSale = {
      id: genId("sale"),
      bookingId,
      customerId,
      customerName: resolvedCustomerName,
      items,
      total,
      paymentMethod,
      giftVoucherId: voucher ? voucher.id : undefined,
      giftVoucherCode: voucher ? voucher.code : undefined,
      giftVoucherAmountUsed: voucherAmount > 0 ? voucherAmount : undefined,
      studentDiscount: !!studentDiscount,
      createdAt: new Date().toISOString(),
    };

    // decrement stock for product items + log as a "sold" stock movement
    for (const item of items) {
      if (item.type === "product") {
        const product = db.products.find((p) => p.id === item.refId);
        if (product) {
          product.stock = Math.max(0, product.stock - item.qty);
          db.stockMovements.push({
            id: genId("mov"),
            productId: product.id,
            productName: product.name,
            type: "sold",
            quantity: item.qty,
            unitPrice: item.price,
            note: "Via kassa",
            saleId: newSale.id,
            createdAt: newSale.createdAt,
          });
        }
      }
    }

    if (bookingId) {
      const booking = db.bookings.find((b) => b.id === bookingId);
      if (booking) booking.status = "done";
    }

    db.sales.push(newSale);
    return { sale: newSale };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json(result.sale);
}
