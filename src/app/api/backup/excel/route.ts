import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { readDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const db = readDB();
  const wb = XLSX.utils.book_new();

  const serviceName = (id: string | null) =>
    db.services.find((s) => s.id === id)?.name || "";
  const customerName = (id: string | null) =>
    db.customers.find((c) => c.id === id)?.name || "";

  // --- Klanten ---
  const klantenRows = db.customers.map((c) => ({
    Naam: c.name,
    GSM: c.phone,
    "E-mail": c.email || "",
    Adres: c.address || "",
    Notities: c.notes || "",
    "Klant sinds": new Date(c.createdAt).toLocaleDateString("nl-BE", { timeZone: "Europe/Brussels" }),
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(klantenRows),
    "Klanten"
  );

  // --- Afspraken ---
  const STATUS_LABEL: Record<string, string> = {
    confirmed: "Bevestigd",
    pending: "Aanvraag",
    done: "Afgerond",
    cancelled: "Geannuleerd",
    blocked: "Geblokkeerd",
    no_show: "No show",
  };
  const afsprakenRows = db.bookings.map((b) => ({
    Datum: new Date(b.start).toLocaleDateString("nl-BE", { timeZone: "Europe/Brussels" }),
    "Start uur": new Date(b.start).toLocaleTimeString("nl-BE", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Brussels",
    }),
    "Eind uur": new Date(b.end).toLocaleTimeString("nl-BE", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Brussels",
    }),
    Klant: b.customerName || customerName(b.customerId),
    Dienst: serviceName(b.serviceId) || b.notes || "Geblokkeerd",
    Status: STATUS_LABEL[b.status] || b.status,
    Notities: b.notes || "",
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(afsprakenRows),
    "Afspraken"
  );

  // --- Diensten & prijzen ---
  const dienstenRows = db.services.map((s) => ({
    Categorie: s.category,
    Dienst: s.name,
    Prijs: s.price,
    "Duur (min)": s.durationMinutes,
    Actief: s.active ? "Ja" : "Nee",
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(dienstenRows),
    "Diensten"
  );

  // --- Voorraad ---
  const voorraadRows = db.products.map((p) => ({
    Product: p.name,
    Voorraad: p.stock,
    Eenheid: p.unit,
    Minimum: p.minStock,
    Aankoopprijs: p.costPrice ?? "",
    Verkoopprijs: p.salePrice ?? "",
    "Aankoopwaarde (voorraad x aankoopprijs)":
      p.costPrice !== undefined ? Math.round(p.costPrice * p.stock * 100) / 100 : "",
  }));
  const totaleAankoopwaarde = db.products.reduce(
    (sum, p) => sum + (p.costPrice ?? 0) * p.stock,
    0
  );
  const voorraadSheet = XLSX.utils.json_to_sheet(voorraadRows);
  XLSX.utils.sheet_add_aoa(
    voorraadSheet,
    [[], ["", "", "", "", "", "Totale aankoopwaarde:", Math.round(totaleAankoopwaarde * 100) / 100]],
    { origin: -1 }
  );
  XLSX.utils.book_append_sheet(
    wb,
    voorraadSheet,
    "Voorraad"
  );

  // --- Voorraadbewegingen ---
  const TYPE_LABEL: Record<string, string> = {
    in: "Inkomend",
    sold: "Verkocht",
    used: "Verbruikt",
  };
  const bewegingenRows = db.stockMovements.map((m) => ({
    Datum: new Date(m.createdAt).toLocaleString("nl-BE", { timeZone: "Europe/Brussels" }),
    Product: m.productName,
    Type: TYPE_LABEL[m.type] || m.type,
    Aantal: m.quantity,
    "Aankoopprijs/eenheid": m.unitCost ?? "",
    "Verkoopprijs/eenheid": m.unitPrice ?? "",
    Notitie: m.note || "",
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(bewegingenRows),
    "Voorraadbewegingen"
  );

  // --- Verkopen (kassa) ---
  const PAYMENT_LABEL: Record<string, string> = {
    cash: "Cash",
    qr: "QR-code",
    voucher: "Cadeaubon",
  };
  const verkopenRows = db.sales.map((s) => ({
    Datum: new Date(s.createdAt).toLocaleString("nl-BE", { timeZone: "Europe/Brussels" }),
    Klant: s.customerName || customerName(s.customerId || null),
    Items: s.items.map((i) => `${i.qty}x ${i.name}`).join(", "),
    Totaal: s.total,
    Betaalwijze: PAYMENT_LABEL[s.paymentMethod] || s.paymentMethod,
    "Cadeaubon gebruikt": s.giftVoucherCode || "",
    "Bedrag via cadeaubon": s.giftVoucherAmountUsed ?? "",
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(verkopenRows),
    "Verkopen"
  );

  // --- Cadeaubonnen ---
  const cadeaubonnenRows = db.giftVouchers.map((v) => ({
    Code: v.code,
    Klant: v.customerName || "",
    Herkomst: v.origin === "sponsoring" ? "Sponsoring (gratis)" : "Betaald door klant",
    Oorspronkelijk: v.originalAmount,
    Resterend: v.remainingAmount,
    Status: v.remainingAmount <= 0 ? "Volledig gebruikt" : "Openstaand",
    Uitgiftedatum: new Date(v.issuedAt).toLocaleDateString("nl-BE", {
      timeZone: "Europe/Brussels",
    }),
    Notitie: v.note || "",
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(cadeaubonnenRows),
    "Cadeaubonnen"
  );

  // --- No-shows (blijvend register, ook als de afspraak zelf al verwijderd is) ---
  const noShowRows = db.noShowRecords.map((r) => ({
    Datum: new Date(r.date).toLocaleString("nl-BE", { timeZone: "Europe/Brussels" }),
    Klant: r.customerName,
    Dienst: r.serviceName,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(noShowRows),
    "No-shows"
  );

  // --- Annuleringen (blijvend register, met reden) ---
  const cancellationRows = db.cancellationRecords.map((r) => ({
    Datum: new Date(r.date).toLocaleString("nl-BE", { timeZone: "Europe/Brussels" }),
    Klant: r.customerName,
    Dienst: r.serviceName,
    Reden: r.reason || "",
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(cancellationRows),
    "Annuleringen"
  );

  // --- Instellingen (basisgegevens, geen wachtwoord) ---
  const instellingenRows = [
    { Veld: "Salonnaam", Waarde: db.settings.businessName },
    { Veld: "Eigenaar", Waarde: db.settings.ownerName },
    { Veld: "Adres", Waarde: db.settings.address },
    { Veld: "Postcode en gemeente", Waarde: db.settings.postalCity },
    { Veld: "GSM", Waarde: db.settings.phone },
    { Veld: "BTW-nummer", Waarde: db.settings.vatNumber || "" },
    { Veld: "Bankrekeningnummer", Waarde: db.settings.bankAccountNumber || "" },
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(instellingenRows),
    "Instellingen"
  );

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const dateStr = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="beij-jelle-overzicht-${dateStr}.xlsx"`,
    },
  });
}
