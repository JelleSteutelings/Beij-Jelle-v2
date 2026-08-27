"use client";

import { useCallback, useEffect, useState } from "react";
import { Booking, DayClosing, Sale, Service } from "@/lib/types";
import { bookingColor } from "@/lib/bookingColor";
import { toBrusselsDateString } from "@/lib/tz";
import CheckoutModal from "./CheckoutModal";
import BlockTimeModal from "./BlockTimeModal";
import CancelReasonModal from "./CancelReasonModal";
import BookingDetailModal from "./BookingDetailModal";
import CorrectionReasonModal from "./CorrectionReasonModal";
import VacationModal from "./VacationModal";
import WeekView from "./WeekView";
import MonthView from "./MonthView";
import { useLayoutMode } from "../LayoutModeContext";

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("nl-BE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Bevestigd",
  pending: "Aanvraag",
  done: "Afgerond",
  cancelled: "Geannuleerd",
  blocked: "Geblokkeerd",
  no_show: "No show",
};

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-emerald-900/40 text-emerald-300 border-emerald-700/50",
  pending: "bg-amber-900/40 text-amber-300 border-amber-700/50",
  done: "bg-cream/10 text-cream/50 border-hairline",
  cancelled: "bg-red-950/40 text-red-400 border-red-800/40 line-through",
  blocked: "bg-panel2 text-cream/40 border-hairline",
  no_show: "bg-red-950/50 text-red-300 border-red-800/50",
};

export default function AgendaPage() {
  const [date, setDate] = useState(formatDate(new Date()));
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [dayClosings, setDayClosings] = useState<DayClosing[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutBooking, setCheckoutBooking] = useState<Booking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<Booking | null>(null);
  const [freeSlot, setFreeSlot] = useState<{ date: string; time: string } | null>(null);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [vacationModalOpen, setVacationModalOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const { setHideNav } = useLayoutMode();

  // Onthoud de voorkeur (bv. altijd breed op een laptop) tussen bezoeken.
  useEffect(() => {
    if (localStorage.getItem("bj_agenda_wide") === "1") setWide(true);
  }, []);

  useEffect(() => {
    setHideNav(wide);
    localStorage.setItem("bj_agenda_wide", wide ? "1" : "0");
    // Bij het verlaten van de pagina de zijbalk altijd terug tonen.
    return () => setHideNav(false);
  }, [wide, setHideNav]);

  // Blijft gesynchroniseerd als de gebruiker volledig scherm verlaat via Esc
  // of een browser-knop, in plaats van onze eigen knop.
  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement) setWide(false);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  async function toggleWide() {
    const next = !wide;
    setWide(next);
    try {
      if (next) {
        await document.documentElement.requestFullscreen?.();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen?.();
      }
    } catch {
      // Sommige browsers/omgevingen (bv. binnen een iframe) staan de
      // Fullscreen-API niet toe — dan blijft in elk geval de bredere
      // lay-out (zonder zijbalk) actief.
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [bRes, sRes, salesRes, closingsRes] = await Promise.all([
      fetch("/api/bookings"),
      fetch("/api/services"),
      fetch("/api/sales"),
      fetch("/api/day-closings"),
    ]);
    const [bData, sData, salesData, closingsData] = await Promise.all([
      bRes.json(),
      sRes.json(),
      salesRes.json(),
      closingsRes.json(),
    ]);
    setBookings(bData);
    setServices(sData);
    setSales(salesData);
    setDayClosings(closingsData);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dayBookings = bookings
    .filter((b) => b.start.slice(0, 10) === date)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const serviceById = (id: string | null) =>
    services.find((s) => s.id === id) || null;

  const saleForBooking = (bookingId: string) =>
    sales.find((s) => s.bookingId === bookingId) || null;

  // Of de dag van deze verkoop al definitief afgesloten is — zolang dat
  // niet zo is, is corrigeren gewoon een fout ingegeven verrichting
  // rechtzetten (geen reden/logje nodig, zie ook Cash).
  function isSaleDayClosed(sale: Sale): boolean {
    const saleDate = toBrusselsDateString(new Date(sale.createdAt));
    const records = dayClosings.filter((c) => c.date === saleDate);
    if (records.length === 0) return false;
    const latest = records.reduce((a, b) => (a.closedAt > b.closedAt ? a : b));
    return !latest.reopenedAt;
  }

  async function updateStatus(id: string, status: string, cancelReason?: string) {
    await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, cancelReason }),
    });
    load();
  }

  async function removeBooking(id: string) {
    if (!confirm("Deze afspraak definitief verwijderen?")) return;
    await fetch(`/api/bookings/${id}`, { method: "DELETE" });
    load();
  }

  async function correctSale(saleId: string, reason: string) {
    await fetch(`/api/sales/${saleId}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    load();
  }

  async function quickDeleteSale(booking: Booking) {
    const sale = saleForBooking(booking.id);
    if (!sale) return;
    if (
      !confirm(
        `Kassaverrichting van ${booking.customerName || "deze klant"} (€${sale.total.toFixed(2)}) verwijderen?`
      )
    ) {
      return;
    }
    await fetch(`/api/sales/${sale.id}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    load();
  }

  function shiftDate(direction: 1 | -1) {
    const d = new Date(date + "T12:00:00");
    if (view === "day") d.setDate(d.getDate() + direction);
    else if (view === "week") d.setDate(d.getDate() + direction * 7);
    else d.setMonth(d.getMonth() + direction);
    setDate(formatDate(d));
  }

  const pendingCount = bookings.filter((b) => b.status === "pending").length;

  return (
    <div className={`p-6 sm:p-10 ${wide ? "max-w-none" : "max-w-4xl"}`}>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl">Agenda</h1>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="text-xs px-3 py-1 rounded-full bg-amber-900/40 text-amber-300 border border-amber-700/50">
              {pendingCount} aanvra{pendingCount === 1 ? "ag" : "gen"} te bevestigen
            </span>
          )}
          <button
            onClick={toggleWide}
            title={wide ? "Terug naar normale weergave" : "Groter weergeven (volledig scherm)"}
            className={`text-xs px-3.5 py-1.5 rounded-full border transition flex items-center gap-1.5 ${
              wide
                ? "bg-gold-gradient text-deep font-semibold border-transparent"
                : "border-hairline text-cream/60 hover:border-gold"
            }`}
          >
            <span aria-hidden>{wide ? "✕" : "⛶"}</span>
            {wide ? "Verkleinen" : "Volledig scherm"}
          </button>
        </div>
      </div>
      <p className="text-cream/40 text-sm mb-6">Overzicht van je afspraken</p>

      <div className="flex items-center gap-1.5 mb-6">
        {(["day", "week", "month"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`text-xs px-3.5 py-1.5 rounded-full border transition ${
              view === v
                ? "bg-gold-gradient text-deep font-semibold border-transparent"
                : "border-hairline text-cream/60 hover:border-gold"
            }`}
          >
            {v === "day" ? "Dag" : v === "week" ? "Week" : "Maand"}
          </button>
        ))}
      </div>

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
          onClick={() => setDate(formatDate(new Date()))}
          className="text-xs text-gold/80 hover:text-gold ml-1"
        >
          Vandaag
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setVacationModalOpen(true)}
          className="text-xs border border-hairline hover:border-gold rounded-full px-4 py-2 transition"
        >
          Vakantie inplannen
        </button>
        <button
          onClick={() => setBlockModalOpen(true)}
          className="text-xs border border-hairline hover:border-gold rounded-full px-4 py-2 transition"
        >
          + Tijd blokkeren / afspraak toevoegen
        </button>
      </div>

      {loading ? (
        <p className="text-cream/40 text-sm">Laden...</p>
      ) : view === "week" ? (
        <WeekView
          date={date}
          bookings={bookings}
          services={services}
          maxHeight={wide ? "calc(100vh - 220px)" : 640}
          onSelectDay={(d) => {
            setDate(d);
            setView("day");
          }}
          onSelectBooking={(b) => setDetailBooking(b)}
          onSelectFreeSlot={(d, t) => setFreeSlot({ date: d, time: t })}
        />
      ) : view === "month" ? (
        <MonthView
          date={date}
          bookings={bookings}
          onSelectDay={(d) => {
            setDate(d);
            setView("day");
          }}
        />
      ) : dayBookings.length === 0 ? (
        <p className="text-cream/40 text-sm">Geen afspraken op deze dag.</p>
      ) : (
        <ul className="space-y-3">
          {dayBookings.map((b) => {
            const service = serviceById(b.serviceId);
            return (
              <li
                key={b.id}
                className="border border-hairline rounded-xl p-4 bg-panel/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-gold-light flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: bookingColor(b.id) }}
                      />
                      {formatTime(b.start)} &ndash; {formatTime(b.end)}
                    </p>
                    <p className="text-sm mt-0.5">
                      {service ? service.name : b.notes || "Geblokkeerd"}
                    </p>
                    <p className="text-xs text-cream/50 mt-0.5">
                      {b.customerName}
                    </p>
                    {b.blocks && b.blocks.length > 1 && (
                      <p className="text-xs text-cream/40 mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
                        {b.blocks.map((block, i) => {
                          const blockStart = new Date(
                            new Date(b.start).getTime() + block.offsetMinutes * 60000
                          );
                          const blockEnd = new Date(
                            blockStart.getTime() + block.durationMinutes * 60000
                          );
                          return (
                            <span key={i}>
                              Blok {i + 1}:{" "}
                              {formatTime(blockStart.toISOString())}
                              &ndash;
                              {formatTime(blockEnd.toISOString())}{" "}
                              <span
                                className={
                                  block.busy ? "text-amber-300/80" : "text-emerald-300/70"
                                }
                              >
                                ({block.busy ? "bezet" : "vrij"})
                              </span>
                            </span>
                          );
                        })}
                      </p>
                    )}
                    {b.notes && service && (
                      <p className="text-xs text-cream/40 mt-1 italic">
                        &ldquo;{b.notes}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_STYLE[b.status]}`}
                    >
                      {STATUS_LABEL[b.status]}
                    </span>
                    {b.status === "done" && saleForBooking(b.id) && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-hairline text-cream/50">
                        {(() => {
                          const method = saleForBooking(b.id)?.paymentMethod;
                          return method === "cash" ? "Cash" : method === "voucher" ? "Cadeaubon" : "QR";
                        })()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {b.status === "pending" && (
                    <>
                      <button
                        onClick={() => updateStatus(b.id, "confirmed")}
                        className="text-xs px-3 py-1.5 rounded-full bg-gold-gradient text-deep font-semibold"
                      >
                        Bevestigen
                      </button>
                      <button
                        onClick={() => setCancelTarget(b)}
                        className="text-xs px-3 py-1.5 rounded-full border border-hairline hover:border-red-700 hover:text-red-400 transition"
                      >
                        Afwijzen
                      </button>
                    </>
                  )}
                  {b.status === "confirmed" && (
                    <>
                      <button
                        onClick={() => setCheckoutBooking(b)}
                        className="text-xs px-3 py-1.5 rounded-full bg-gold-gradient text-deep font-semibold"
                      >
                        Afronden &amp; kassa
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`${b.customerName} niet komen opdagen voor deze afspraak?`)) {
                            updateStatus(b.id, "no_show");
                          }
                        }}
                        className="text-xs px-3 py-1.5 rounded-full border border-red-800/50 text-red-400 hover:bg-red-950/30 transition"
                      >
                        No show
                      </button>
                      <button
                        onClick={() => setCancelTarget(b)}
                        className="text-xs px-3 py-1.5 rounded-full border border-hairline hover:border-red-700 hover:text-red-400 transition"
                      >
                        Annuleren
                      </button>
                    </>
                  )}
                  {b.status === "no_show" && (
                    <button
                      onClick={() => updateStatus(b.id, "confirmed")}
                      className="text-xs px-3 py-1.5 rounded-full border border-emerald-700/50 text-emerald-300 hover:bg-emerald-950/30 transition"
                    >
                      Annuleren No Show
                    </button>
                  )}
                  {b.status === "done" && saleForBooking(b.id) && (
                    <>
                      {!isSaleDayClosed(saleForBooking(b.id)!) ? (
                        <>
                          <button
                            onClick={() => setCheckoutBooking(b)}
                            className="text-xs px-3 py-1.5 rounded-full border border-hairline hover:border-gold transition"
                            title="Klant bedacht zich achteraf? Pas hier het bedrag of de betaalwijze aan."
                          >
                            Bedrag/betaling aanpassen
                          </button>
                          <button
                            onClick={() => quickDeleteSale(b)}
                            className="text-xs px-3 py-1.5 rounded-full border border-hairline hover:border-red-700 hover:text-red-400 transition"
                            title="Verkeerd geboekt? Verwijderen kan nog vrij zolang de dag niet is afgesloten."
                          >
                            Verwijderen
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setCorrectionTarget(b)}
                          className="text-xs px-3 py-1.5 rounded-full border border-hairline text-cream/40 hover:border-red-700 hover:text-red-400 transition"
                        >
                          Kassaverrichting corrigeren
                        </button>
                      )}
                    </>
                  )}
                  {(b.status === "cancelled" || b.status === "blocked" || b.status === "no_show") && (
                    <button
                      onClick={() => removeBooking(b.id)}
                      className="text-xs px-3 py-1.5 rounded-full border border-hairline hover:border-red-700 hover:text-red-400 transition"
                    >
                      Verwijderen
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {checkoutBooking && (
        <CheckoutModal
          booking={checkoutBooking}
          service={serviceById(checkoutBooking.serviceId)}
          existingSale={saleForBooking(checkoutBooking.id)}
          onClose={() => setCheckoutBooking(null)}
          onDone={() => {
            setCheckoutBooking(null);
            load();
          }}
        />
      )}

      {blockModalOpen && (
        <BlockTimeModal
          date={date}
          onClose={() => setBlockModalOpen(false)}
          onDone={() => {
            setBlockModalOpen(false);
            load();
          }}
        />
      )}

      {vacationModalOpen && (
        <VacationModal
          onClose={() => setVacationModalOpen(false)}
          onDone={() => {
            setVacationModalOpen(false);
            load();
          }}
        />
      )}

      {cancelTarget && (
        <CancelReasonModal
          customerName={cancelTarget.customerName || "deze klant"}
          onClose={() => setCancelTarget(null)}
          onConfirm={(reason) => {
            updateStatus(cancelTarget.id, "cancelled", reason);
            setCancelTarget(null);
          }}
        />
      )}

      {detailBooking && (() => {
        const detailSale = saleForBooking(detailBooking.id);
        const detailDayClosed = detailSale ? isSaleDayClosed(detailSale) : false;
        return (
        <BookingDetailModal
          booking={detailBooking}
          service={serviceById(detailBooking.serviceId)}
          isDayClosed={detailDayClosed}
          onClose={() => setDetailBooking(null)}
          onCheckout={() => {
            setCheckoutBooking(detailBooking);
            setDetailBooking(null);
          }}
          onCancel={() => {
            setCancelTarget(detailBooking);
            setDetailBooking(null);
          }}
          onNoShow={() => {
            if (confirm(`${detailBooking.customerName} niet komen opdagen voor deze afspraak?`)) {
              updateStatus(detailBooking.id, "no_show");
              setDetailBooking(null);
            }
          }}
          onRevertNoShow={() => {
            updateStatus(detailBooking.id, "confirmed");
            setDetailBooking(null);
          }}
          onConfirm={() => {
            updateStatus(detailBooking.id, "confirmed");
            setDetailBooking(null);
          }}
          onDelete={() => {
            removeBooking(detailBooking.id);
            setDetailBooking(null);
          }}
          onQuickDeleteSale={
            detailSale
              ? () => {
                  quickDeleteSale(detailBooking);
                  setDetailBooking(null);
                }
              : undefined
          }
          onCorrect={
            detailSale
              ? () => {
                  setCorrectionTarget(detailBooking);
                  setDetailBooking(null);
                }
              : undefined
          }
        />
        );
      })()}

      {correctionTarget && (() => {
        const sale = saleForBooking(correctionTarget.id);
        if (!sale) return null;
        return (
          <CorrectionReasonModal
            customerName={correctionTarget.customerName || "deze klant"}
            total={sale.total}
            onClose={() => setCorrectionTarget(null)}
            onConfirm={async (reason) => {
              await correctSale(sale.id, reason);
              setCorrectionTarget(null);
            }}
          />
        );
      })()}

      {freeSlot && (
        <BlockTimeModal
          date={freeSlot.date}
          initialTime={freeSlot.time}
          initialMode="appointment"
          onClose={() => setFreeSlot(null)}
          onDone={() => {
            setFreeSlot(null);
            load();
          }}
        />
      )}
    </div>
  );
}
