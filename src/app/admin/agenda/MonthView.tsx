"use client";

import { Booking } from "@/lib/types";

const DAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function MonthView({
  date,
  bookings,
  onSelectDay,
}: {
  date: string;
  bookings: Booking[];
  onSelectDay: (dateStr: string) => void;
}) {
  const current = new Date(date + "T12:00:00");
  const year = current.getFullYear();
  const month = current.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - startOffset);

  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const todayStr = toDateStr(new Date());

  function bookingsFor(dStr: string) {
    return bookings.filter(
      (b) => b.start.slice(0, 10) === dStr && b.status !== "cancelled"
    );
  }

  return (
    <div className="border-2 rounded-xl overflow-hidden bg-panel/20" style={{ borderColor: "rgba(224,168,63,0.35)" }}>
      <div className="grid grid-cols-7 border-b-2" style={{ borderColor: "rgba(224,168,63,0.35)" }}>
        {DAY_LABELS.map((l) => (
          <div
            key={l}
            className="py-2.5 text-center text-[11px] text-cream/40 uppercase tracking-wide border-l-2 first:border-l-0"
            style={{ borderColor: "rgba(224,168,63,0.3)" }}
          >
            {l}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const dStr = toDateStr(d);
          const inMonth = d.getMonth() === month;
          const isToday = dStr === todayStr;
          const dayBookings = bookingsFor(dStr);
          const pendingCount = dayBookings.filter((b) => b.status === "pending").length;

          return (
            <button
              key={i}
              onClick={() => onSelectDay(dStr)}
              className={`min-h-[92px] p-2 text-left border-l-2 border-t-2 first-of-type:border-l-0 hover:bg-panel transition ${
                inMonth ? "" : "opacity-30"
              } ${isToday ? "bg-panel2" : ""}`}
              style={{
                borderColor: "rgba(224,168,63,0.22)",
                ...(i < 7 ? { borderTop: "none" } : {}),
              }}
            >
              <div
                className={`text-sm font-display mb-1.5 ${isToday ? "text-gold-light" : "text-cream/70"}`}
              >
                {d.getDate()}
              </div>
              {dayBookings.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-panel2 border-2 border-hairline text-cream/60">
                    {dayBookings.length}
                  </span>
                  {pendingCount > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-900/50 border-2 border-amber-700/50 text-amber-300">
                      {pendingCount} aanvraag
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
