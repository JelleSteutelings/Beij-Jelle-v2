"use client";

import { useEffect, useMemo, useState } from "react";
import { Booking, Customer, DayClosing, Sale } from "@/lib/types";
import { brusselsWallTimeToDate, toBrusselsDateString } from "@/lib/tz";
import CloseDayModal from "./CloseDayModal";
import ReopenDayModal from "./ReopenDayModal";
import CheckoutModal from "../agenda/CheckoutModal";
import CorrectionReasonModal from "../agenda/CorrectionReasonModal";

/** Bouwt een minimale Booking op basis van een Sale, enkel om CheckoutModal
 * te kunnen tonen vanuit de dagontvangsten-lijst (die modal verwacht een
 * "booking"-prop, maar gebruikt die bij het aanpassen van een bestaande
 * verkoop enkel voor de klantnaam in de titel — de echte opslag gebeurt via
 * PATCH /api/sales/[id] met de verkoop zelf). Werkt zowel voor verkopen
 * gekoppeld aan een afspraak als voor losse verkopen (Snelle verkoop). */
function pseudoBookingForSale(s: Sale): Booking {
  return {
    id: s.bookingId || s.id,
    serviceId: s.items.find((i) => i.type === "service")?.refId || null,
    customerId: s.customerId || null,
    customerName: s.customerName,
    start: s.createdAt,
    end: s.createdAt,
    status: "done",
    createdAt: s.createdAt,
  };
}

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

export default function CashPage() {
  const [date, setDate] = useState(toBrusselsDateString(new Date()));
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dayClosings, setDayClosings] = useState<DayClosing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [correctingSale, setCorrectingSale] = useState<Sale | null>(null);

  function loadDayClosings() {
    return fetch("/api/day-closings").then((r) => r.json()).then(setDayClosings);
  }

  function loadSales() {
    return fetch("/api/sales").then((r) => r.json()).then(setSales);
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/sales").then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
      loadDayClosings(),
    ]).then(([s, c]) => {
      setSales(s);
      setCustomers(c);
      setLoading(false);
    });
  }, []);

  async function correctSale(saleId: string, reason: string) {
    await fetch(`/api/sales/${saleId}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    await loadSales();
    setCorrectingSale(null);
  }

  // Zolang de dag nog niet definitief afgesloten is, is dit gewoon een
  // fout ingegeven verrichting rechtzetten: geen reden nodig, geen
  // correctielogje (dat is enkel voor wat er ná afsluiten nog verandert).
  async function deleteDraftSale(s: Sale) {
    if (
      !confirm(
        `Verkoop van ${customerName(s)} (€${s.total.toFixed(2)}) verwijderen?`
      )
    ) {
      return;
    }
    await fetch(`/api/sales/${s.id}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await loadSales();
  }

  const today = toBrusselsDateString(new Date());
  const closingForDate = useMemo(() => {
    const records = dayClosings.filter((c) => c.date === date);
    if (records.length === 0) return null;
    return records.reduce((a, b) => (a.closedAt > b.closedAt ? a : b));
  }, [dayClosings, date]);
  const isDayClosed = !!closingForDate && !closingForDate.reopenedAt;

  async function closeDay() {
    setCloseError(null);
    const res = await fetch("/api/day-closings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    if (res.ok) {
      await loadDayClosings();
      setShowCloseModal(false);
    } else {
      const data = await res.json().catch(() => ({}));
      setCloseError(data.error || "Afsluiten is mislukt. Probeer opnieuw.");
      setShowCloseModal(false);
    }
  }

  async function reopenDay(password: string, reason: string): Promise<string | null> {
    const res = await fetch("/api/day-closings/reopen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, password, reason }),
    });
    if (res.ok) {
      await loadDayClosings();
      setShowReopenModal(false);
      return null;
    }
    const data = await res.json().catch(() => ({}));
    return data.error || "Heropenen is mislukt. Probeer opnieuw.";
  }

  const dayStart = useMemo(() => brusselsWallTimeToDate(date, "00:00"), [date]);
  const dayEnd = useMemo(() => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + 1);
    return brusselsWallTimeToDate(d.toISOString().slice(0, 10), "00:00");
  }, [date]);

  const daySales = useMemo(() => {
    return sales
      .filter((s) => {
        const t = new Date(s.createdAt).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [sales, dayStart, dayEnd]);

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

          {closeError && <p className="text-red-400 text-xs mb-4">{closeError}</p>}

          <div className="mb-8">
            {isDayClosed ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-emerald-800/40 bg-emerald-950/20">
                <p className="text-xs text-emerald-300">
                  Definitief afgesloten op{" "}
                  {new Date(closingForDate!.closedAt).toLocaleString("nl-BE", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Brussels",
                  })}
                </p>
                <button
                  onClick={() => setShowReopenModal(true)}
                  className="text-xs text-cream/40 hover:text-gold shrink-0"
                >
                  Heropenen
                </button>
              </div>
            ) : date <= today ? (
              <button
                onClick={() => setShowCloseModal(true)}
                className="text-xs px-4 py-2 rounded-full border border-hairline hover:border-gold transition"
              >
                Dag definitief afsluiten
              </button>
            ) : null}
          </div>

          <h2 className="text-xs text-gold/80 uppercase tracking-wide mb-2">
            Verrichtingen ({daySales.length})
          </h2>
          {daySales.length === 0 ? (
            <p className="text-cream/40 text-sm">Geen kassaverrichtingen op deze dag.</p>
          ) : (
            <ul className="space-y-2">
              {daySales.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-hairline bg-panel/30"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-cream/80">
                      {formatTime(s.createdAt)} &middot; {customerName(s)}
                    </p>
                    <p className="text-xs text-cream/40 truncate">
                      {s.items.map((i) => `${i.qty}x ${i.name}`).join(", ")}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {!isDayClosed ? (
                        <>
                          <button
                            onClick={() => setEditingSale(s)}
                            className="text-[11px] text-gold/70 hover:text-gold underline underline-offset-2"
                          >
                            Aanpassen
                          </button>
                          <button
                            onClick={() => deleteDraftSale(s)}
                            className="text-[11px] text-cream/30 hover:text-red-400 underline underline-offset-2"
                          >
                            Verwijderen
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setCorrectingSale(s)}
                          className="text-[11px] text-cream/30 hover:text-red-400 underline underline-offset-2"
                        >
                          Corrigeren
                        </button>
                      )}
                    </div>
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
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {showCloseModal && (
        <CloseDayModal
          dateLabel={dateLabel}
          salesCount={daySales.length}
          total={grandTotal}
          onClose={() => setShowCloseModal(false)}
          onConfirm={closeDay}
        />
      )}
      {showReopenModal && (
        <ReopenDayModal
          dateLabel={dateLabel}
          onClose={() => setShowReopenModal(false)}
          onConfirm={reopenDay}
        />
      )}

      {editingSale && (
        <CheckoutModal
          booking={pseudoBookingForSale(editingSale)}
          service={null}
          existingSale={editingSale}
          onClose={() => setEditingSale(null)}
          onDone={() => {
            setEditingSale(null);
            loadSales();
          }}
        />
      )}

      {correctingSale && (
        <CorrectionReasonModal
          customerName={customerName(correctingSale)}
          total={correctingSale.total}
          onClose={() => setCorrectingSale(null)}
          onConfirm={(reason) => correctSale(correctingSale.id, reason)}
        />
      )}
    </div>
  );
}
