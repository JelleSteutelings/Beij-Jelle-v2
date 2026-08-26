"use client";

import { useEffect, useMemo, useState } from "react";
import { Booking, Customer, Sale } from "@/lib/types";
import { toBrusselsDateString } from "@/lib/tz";

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function eur(n: number) {
  return `€${n.toFixed(2)}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("nl-BE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Brussels",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("nl-BE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Brussels",
  });
}

function formatDayLabel(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "short",
  });
}

export default function CashPage() {
  const [date, setDate] = useState(toBrusselsDateString(new Date()));
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);

  function loadSales() {
    return fetch("/api/sales")
      .then((r) => r.json())
      .then(setSales);
  }

  useEffect(() => {
    Promise.all([
      loadSales(),
      fetch("/api/customers").then((r) => r.json()).then(setCustomers),
      fetch("/api/bookings").then((r) => r.json()).then(setBookings),
    ]).then(() => setLoading(false));
  }, []);

  const bookingsById = useMemo(() => {
    const map = new Map<string, Booking>();
    for (const b of bookings) map.set(b.id, b);
    return map;
  }, [bookings]);

  // De dag waarop een verrichting toont: de handmatige overschrijving
  // (cashDate) indien gezet, anders gewoon de dag waarop de kassa echt
  // afgerond werd (createdAt, in Brussel-tijd).
  const effectiveDay = (s: Sale) => s.cashDate || toBrusselsDateString(new Date(s.createdAt));

  // De dag van de gekoppelde afspraak, indien die nog bestaat — null als er
  // geen (meer) een gekoppelde afspraak is (bv. losse verkoop).
  const appointmentDay = (s: Sale) => {
    if (!s.bookingId) return null;
    const b = bookingsById.get(s.bookingId);
    return b ? toBrusselsDateString(new Date(b.start)) : null;
  };

  const daySales = useMemo(() => {
    return sales
      .filter((s) => effectiveDay(s) === date)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, date, bookingsById]);

  async function moveToDay(sale: Sale, targetDay: string | null) {
    setMovingId(sale.id);
    await fetch(`/api/sales/${sale.id}/cash-date`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cashDate: targetDay }),
    });
    await loadSales();
    setMovingId(null);
  }

  const cashTotal = daySales
    .filter((s) => s.paymentMethod === "cash")
    .reduce((sum, s) => sum + s.total, 0);
  const qrTotal = daySales
    .filter((s) => s.paymentMethod === "qr")
    .reduce((sum, s) => sum + s.total, 0);
  const voucherTotal = daySales
    .filter((s) => s.paymentMethod === "voucher")
    .reduce((sum, s) => sum + s.total, 0);
  const grandTotal = cashTotal + qrTotal + voucherTotal;

  const customerName = (s: Sale) =>
    s.customerName || customers.find((c) => c.id === s.customerId)?.name || "—";

  function shiftDate(direction: 1 | -1) {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + direction);
    setDate(formatDate(d));
  }

  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="p-6 sm:p-10 max-w-2xl">
      <h1 className="font-display text-2xl mb-1">Cash</h1>
      <p className="text-cream/40 text-sm mb-6">Dagontvangsten, gesplitst per betaalwijze</p>

      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => shiftDate(-1)}
          className="w-9 h-9 rounded-full border border-hairline hover:border-gold transition"
        >
          &larr;
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-panel border border-hairline rounded-lg px-4 py-2 focus:outline-none focus:border-gold [color-scheme:dark]"
        />
        <button
          onClick={() => shiftDate(1)}
          className="w-9 h-9 rounded-full border border-hairline hover:border-gold transition"
        >
          &rarr;
        </button>
        <button
          onClick={() => setDate(toBrusselsDateString(new Date()))}
          className="text-xs text-gold/80 hover:text-gold ml-1"
        >
          Vandaag
        </button>
      </div>

      {loading ? (
        <p className="text-cream/40 text-sm">Laden...</p>
      ) : (
        <>
          <p className="text-sm text-cream/50 mb-4">{dateLabel}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <div className="border border-hairline rounded-xl p-4 bg-panel/30">
              <p className="text-[11px] text-cream/40 mb-1">Cash</p>
              <p className="font-display text-2xl text-gold-light">{eur(cashTotal)}</p>
            </div>
            <div className="border border-hairline rounded-xl p-4 bg-panel/30">
              <p className="text-[11px] text-cream/40 mb-1">Payconiq / QR</p>
              <p className="font-display text-2xl text-gold-light">{eur(qrTotal)}</p>
            </div>
            <div className="border border-hairline rounded-xl p-4 bg-panel/30">
              <p className="text-[11px] text-cream/40 mb-1">Cadeaubon</p>
              <p className="font-display text-2xl text-gold-light">{eur(voucherTotal)}</p>
            </div>
            <div className="border border-gold/50 rounded-xl p-4 bg-panel2/50">
              <p className="text-[11px] text-gold/70 mb-1">Totaal</p>
              <p className="font-display text-2xl text-gold-light">{eur(grandTotal)}</p>
            </div>
          </div>

          <h2 className="text-xs text-gold/80 uppercase tracking-wide mb-2">
            Verrichtingen ({daySales.length})
          </h2>
          {daySales.length === 0 ? (
            <p className="text-cream/40 text-sm">Geen kassaverrichtingen op deze dag.</p>
          ) : (
            <ul className="space-y-2">
              {daySales.map((s) => {
                const apptDay = appointmentDay(s);
                const isMoved = !!s.cashDate;
                // Enkel een verplaats-suggestie tonen als er een gekoppelde
                // afspraak is met een écht andere dag dan waar deze
                // verrichting nu staat.
                const suggestMove = !isMoved && apptDay && apptDay !== date;

                return (
                  <li
                    key={s.id}
                    className="px-4 py-3 rounded-xl border border-hairline bg-panel/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-cream/80">
                          {isMoved ? customerName(s) : `${formatTime(s.createdAt)} · ${customerName(s)}`}
                        </p>
                        <p className="text-xs text-cream/40 truncate">
                          {s.items.map((i) => `${i.qty}x ${i.name}`).join(", ")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-display text-gold-light">{eur(s.total)}</p>
                        <p className="text-[11px] text-cream/40">
                          {s.paymentMethod === "cash"
                            ? "Cash"
                            : s.paymentMethod === "qr"
                            ? "QR"
                            : "Cadeaubon"}
                        </p>
                      </div>
                    </div>

                    {isMoved && (
                      <div className="mt-2 pt-2 border-t border-hairline/60 flex items-center justify-between gap-2 text-[11px] text-cream/40">
                        <span>
                          Verplaatst naar afspraakdag &mdash; echt afgerond op{" "}
                          {formatDateTime(s.createdAt)}
                        </span>
                        <button
                          onClick={() => moveToDay(s, null)}
                          disabled={movingId === s.id}
                          className="text-gold/70 hover:text-gold underline underline-offset-2 shrink-0 disabled:opacity-40"
                        >
                          terugzetten
                        </button>
                      </div>
                    )}

                    {suggestMove && (
                      <div className="mt-2 pt-2 border-t border-hairline/60 flex items-center justify-between gap-2 text-[11px] text-amber-300/90">
                        <span>Afspraak was gepland op {formatDayLabel(apptDay!)}</span>
                        <button
                          onClick={() => moveToDay(s, apptDay)}
                          disabled={movingId === s.id}
                          className="text-gold hover:text-gold-light underline underline-offset-2 shrink-0 disabled:opacity-40"
                        >
                          {movingId === s.id ? "bezig..." : "verplaats hierheen"}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
