import { NextRequest, NextResponse } from "next/server";
import { mutateDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { SaleItem, SalePaymentMethod } from "@/lib/types";
import { isDayClosed } from "@/lib/dayClosing";
import { toBrusselsDateString } from "@/lib/tz";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json();
  const { items, paymentMethod, giftVoucherId, giftVoucherAmountUsed, totalOverride, studentDiscount } = body as {
    items: SaleItem[];
    paymentMethod: SalePaymentMethod;
    giftVoucherId?: string;
    giftVoucherAmountUsed?: number;
    totalOverride?: number;
    studentDiscount?: boolean;
  };

  const result = await mutateDB((db) => {
    const sale = db.sales.find((s) => s.id === params.id);
    if (!sale) return { error: "Verkoop niet gevonden" };

    const saleDate = toBrusselsDateString(new Date(sale.createdAt));
    if (isDayClosed(db, saleDate)) {
      return {
        error:
          "Deze dag is al definitief afgesloten en kan niet meer op deze manier aangepast worden. Gebruik indien nodig de correctie-optie, of heropen de dag bij Cash.",
      };
    }

    // Eerst de vorige cadeaubon-afboeking terugdraaien, indien van toepassing.
    if (sale.giftVoucherId && sale.giftVoucherAmountUsed) {
      const oldVoucher = db.giftVouchers.find((v) => v.id === sale.giftVoucherId);
      if (oldVoucher) {
        oldVoucher.remainingAmount =
          Math.round((oldVoucher.remainingAmount + sale.giftVoucherAmountUsed) * 100) / 100;
      }
    }

    const itemsTotal = (items || sale.items).reduce((sum, i) => sum + i.price * i.qty, 0);
    const total =
      totalOverride !== undefined && totalOverride >= 0
        ? Math.round(totalOverride * 100) / 100
        : itemsTotal;

    let newVoucherAmount = 0;
    let newVoucher = null;
    if (giftVoucherId && giftVoucherAmountUsed && giftVoucherAmountUsed > 0) {
      newVoucher = db.giftVouchers.find((v) => v.id === giftVoucherId);
      if (!newVoucher) return { error: "Cadeaubon niet gevonden." };
      if (giftVoucherAmountUsed > newVoucher.remainingAmount) {
        return { error: "Dit bedrag overschrijdt het resterend saldo van de cadeaubon." };
      }
      if (giftVoucherAmountUsed > total) {
        return { error: "Het cadeaubon-bedrag kan niet hoger zijn dan het totaal." };
      }
      newVoucherAmount = giftVoucherAmountUsed;
      newVoucher.remainingAmount =
        Math.round((newVoucher.remainingAmount - newVoucherAmount) * 100) / 100;
    }

    sale.items = items || sale.items;
    sale.total = total;
    sale.paymentMethod = paymentMethod || sale.paymentMethod;
    sale.giftVoucherId = newVoucher ? newVoucher.id : undefined;
    sale.giftVoucherCode = newVoucher ? newVoucher.code : undefined;
    sale.giftVoucherAmountUsed = newVoucherAmount > 0 ? newVoucherAmount : undefined;
    if (studentDiscount !== undefined) sale.studentDiscount = studentDiscount;

    return { sale };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json(result.sale);
}
