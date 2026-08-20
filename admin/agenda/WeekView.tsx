"use client";

import { Booking, BookingBlock, Service } from "@/lib/types";
import { bookingColor } from "@/lib/bookingColor";

const GRID_START_MIN = 7 * 60; // 07:00
const GRID_END_MIN = 21 * 60; // 21:00
const ROW_MIN = 30;
const ROW_HEIGHT = 40; // px per 30 min

const DAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

const STATUS_OPACITY: Record<string, string> = {
  confirmed: "opacity-100",
  pending: "opacity-70",
  done: "opacity-30",
  blocked: "opacity-100",
  cancelled: "opacity-0",
  no_show: "opacity-40 grayscale",
};

function mondayOf(dateStr: string): Date {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay(); // 0 = sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function minutesSinceMidnight(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("nl-BE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function minutesToTimeStr(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function mainColorOf(service: Service | null, bookingId: string): string {
  if (service?.color) return service.color;
  return bookingColor(bookingId);
}

export default function WeekView({
  date,
  bookings,
  services,
  onSelectDay,
  onSelectBooking,
  onSelectFreeSlot,
  maxHeight = 640,
}: {
  date: string;
  bookings: Booking[];
  services: Service[];
  onSelectDay: (dateStr: string) => void;
  onSelectBooking?: (b: Booking) => void;
  onSelectFreeSlot?: (dateStr: string, timeStr: string) => void;
  maxHeight?: number | string;
}) {
  const monday = mondayOf(date);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });

  const totalRows = (GRID_END_MIN - GRID_START_MIN) / ROW_MIN;
  const gridHeight = totalRows * ROW_HEIGHT;
  const todayStr = toDateStr(new Date());

  const serviceById = (id: string | null) => services.find((s) => s.id === id) || null;

  function handleEmptyClick(dStr: string, e: React.MouseEvent<HTMLDivElement>) {
    if (!onSelectFreeSlot) {
      onSelectDay(dStr);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const rawMin = GRID_START_MIN + (offsetY / ROW_HEIGHT) * ROW_MIN;
    const snapped = Math.round(rawMin / 15) * 15;
    onSelectFreeSlot(dStr, minutesToTimeStr(snapped));
  }

  return (
    <div className="border border-hairline rounded-xl overflow-hidden bg-panel/20">
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b-2" style={{ borderColor: "rgba(224,168,63,0.45)" }}>
        <div />
        {weekDays.map((d) => {
          const dStr = toDateStr(d);
          const isToday = dStr === todayStr;
          return (
            <button
              key={dStr}
              onClick={() => onSelectDay(dStr)}
              className={`py-3 text-center border-l-2 hover:bg-panel transition ${
                isToday ? "bg-panel2" : ""
              }`}
              style={{ borderColor: "rgba(224,168,63,0.3)" }}
            >
              <div className="text-[11px] text-cream/40 uppercase tracking-wide">
                {DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]}
              </div>
              <div
                className={`font-display text-base ${isToday ? "text-gold-light" : "text-cream/80"}`}
              >
                {d.getDate()}
              </div>
            </button>
          );
        })}
      </div>

      <div className="relative overflow-y-auto" style={{ maxHeight }}>
        <div
          className="grid grid-cols-[48px_repeat(7,1fr)] relative"
          style={{ height: gridHeight }}
        >
          {/* hour labels + horizontal lines */}
          <div className="relative">
            {Array.from({ length: totalRows + 1 }).map((_, i) => {
              const min = GRID_START_MIN + i * ROW_MIN;
              if (min % 60 !== 0) return null;
              return (
                <div
                  key={i}
                  className="absolute right-2 text-[11px] text-cream/40 -translate-y-1/2 font-medium"
                  style={{ top: i * ROW_HEIGHT }}
                >
                  {String(Math.floor(min / 60)).padStart(2, "0")}:00
                </div>
              );
            })}
          </div>

          {weekDays.map((d) => {
            const dStr = toDateStr(d);
            const dayBookings = bookings.filter(
              (b) => b.start.slice(0, 10) === dStr && b.status !== "cancelled"
            );
            return (
              <div
                key={dStr}
                className="relative border-l-2 cursor-pointer"
                style={{ borderColor: "rgba(224,168,63,0.3)" }}
                onClick={(e) => handleEmptyClick(dStr, e)}
              >
                {Array.from({ length: totalRows }).map((_, i) => {
                  const min = GRID_START_MIN + i * ROW_MIN;
                  const isHour = min % 60 === 0;
                  return (
                    <div
                      key={i}
                      className="absolute w-full"
                      style={{
                        top: i * ROW_HEIGHT,
                        borderTop: isHour
                          ? "2px solid rgba(224,168,63,0.35)"
                          : "1px solid rgba(224,168,63,0.16)",
                      }}
                    />
                  );
                })}

                {dayBookings.map((b) => {
                  const baseStart = minutesSinceMidnight(b.start);
                  const service = serviceById(b.serviceId);
                  const mainColor = mainColorOf(service, b.id);
                  const blocks: BookingBlock[] =
                    b.blocks && b.blocks.length > 0
                      ? b.blocks
                      : [
                          {
                            offsetMinutes: 0,
                            durationMinutes:
                              (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000,
                            busy: true,
                          },
                        ];

                  return blocks.map((block, bi) => {
                    const blockStartMin = baseStart + block.offsetMinutes;
                    const top =
                      ((blockStartMin - GRID_START_MIN) / ROW_MIN) * ROW_HEIGHT;
                    const height = Math.max(
                      (block.durationMinutes / ROW_MIN) * ROW_HEIGHT - 3,
                      20
                    );
                    const label = service?.name || b.notes || "Geblokkeerd";
                    const blockStartLabel = minutesToTimeStr(blockStartMin);

                    if (!block.busy) {
                      return (
                        <div
                          key={`${b.id}_${bi}`}
                          title={`Vrij (${label}${blocks.length > 1 ? ` — blok ${bi + 1}` : ""} — ${b.customerName}) — klik om hier iets te boeken`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFreeSlot?.(dStr, blockStartLabel);
                          }}
                          className="absolute left-1 right-1 rounded-lg border-2 border-dashed bg-transparent flex flex-col items-center justify-center hover:bg-gold/5 transition"
                          style={{ top, height, borderColor: "rgba(224,168,63,0.35)" }}
                        >
                          <span className="text-[10px] text-cream/35 uppercase tracking-wide font-medium">
                            vrij vanaf {blockStartLabel}
                            {blocks.length > 1 && ` · blok ${bi + 1}`}
                          </span>
                        </div>
                      );
                    }

                    // Blok 1 volgt altijd de hoofdkleur; latere blokken kunnen een eigen
                    // kleur hebben — die krijgen dan links een baan in de hoofdkleur, zodat
                    // ze visueel gelinkt blijven aan de dienst. De kleur wordt live opgezocht
                    // bij de huidige dienst-instellingen (niet de snapshot van de boeking), zodat
                    // een kleurwijziging ook voor al geplande afspraken meteen zichtbaar is.
                    const ownColor = bi > 0 ? service?.blocks?.[bi]?.color : undefined;
                    const fill = ownColor || mainColor;
                    const showStripe = !!ownColor && ownColor !== mainColor;
                    const showBlockNumber = blocks.length > 1;

                    return (
                      <div
                        key={`${b.id}_${bi}`}
                        title={`${blockStartLabel} ${label}${showBlockNumber ? ` — blok ${bi + 1}` : ""} — ${b.customerName} (klik voor details)`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectBooking?.(b);
                        }}
                        className={`absolute left-1 right-1 rounded-lg border-2 px-1.5 py-1 overflow-hidden text-[11px] leading-snug text-deep hover:brightness-110 transition ${STATUS_OPACITY[b.status]}`}
                        style={{ top, height, backgroundColor: fill, borderColor: fill }}
                      >
                        {showStripe && (
                          <div
                            className="absolute left-0 top-0 bottom-0 w-1.5"
                            style={{ backgroundColor: mainColor }}
                            aria-hidden
                          />
                        )}
                        <div className="font-semibold flex items-baseline gap-1 min-w-0">
                          <span className="truncate min-w-0">
                            {blockStartLabel} {b.customerName}
                          </span>
                          {showBlockNumber && (
                            <span className="shrink-0 text-[9px] font-normal opacity-70">
                              B{bi + 1}
                            </span>
                          )}
                        </div>
                        {bi === 0 && (
                          <div className="truncate opacity-80">{label}</div>
                        )}
                      </div>
                    );
                  });
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
