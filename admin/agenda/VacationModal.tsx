"use client";

import { useState } from "react";
import { brusselsWallTimeToDate } from "@/lib/tz";

type Mode = "halve_dag" | "dagen" | "weken";

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function listDatesBetween(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  let cur = startStr;
  let guard = 0;
  while (new Date(cur + "T12:00:00").getTime() <= new Date(endStr + "T12:00:00").getTime()) {
    dates.push(cur);
    cur = addDays(cur, 1);
    guard++;
    if (guard > 400) break; // veiligheidsgrens
  }
  return dates;
}

export default function VacationModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<Mode>("dagen");
  const today = formatDate(new Date());

  const [halfDayDate, setHalfDayDate] = useState(today);
  const [halfDayPart, setHalfDayPart] = useState<"voormiddag" | "namiddag">("voormiddag");

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [weekStart, setWeekStart] = useState(today);
  const [weekCount, setWeekCount] = useState(1);

  const [note, setNote] = useState("Vakantie");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  function computeBlocks(): { start: Date; end: Date }[] {
    if (mode === "halve_dag") {
      const start =
        halfDayPart === "voormiddag"
          ? brusselsWallTimeToDate(halfDayDate, "00:00")
          : brusselsWallTimeToDate(halfDayDate, "12:00");
      const end =
        halfDayPart === "voormiddag"
          ? brusselsWallTimeToDate(halfDayDate, "12:00")
          : brusselsWallTimeToDate(addDays(halfDayDate, 1), "00:00");
      return [{ start, end }];
    }

    if (mode === "dagen") {
      return listDatesBetween(startDate, endDate).map((d) => ({
        start: brusselsWallTimeToDate(d, "00:00"),
        end: brusselsWallTimeToDate(addDays(d, 1), "00:00"),
      }));
    }

    // weken
    const weekEnd = addDays(weekStart, weekCount * 7 - 1);
    return listDatesBetween(weekStart, weekEnd).map((d) => ({
      start: brusselsWallTimeToDate(d, "00:00"),
      end: brusselsWallTimeToDate(addDays(d, 1), "00:00"),
    }));
  }

  async function handleSubmit() {
    const blocks = computeBlocks();
    if (blocks.length === 0) {
      setError("Kies een geldige periode.");
      return;
    }
    setSubmitting(true);
    setError(null);

    let done = 0;
    for (const block of blocks) {
      setProgress(`${done + 1} / ${blocks.length}`);
      try {
        await fetch("/api/bookings/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId: null,
            start: block.start.toISOString(),
            end: block.end.toISOString(),
            status: "blocked",
            customerName: note || "Vakantie",
            notes: note || "Vakantie",
          }),
        });
      } catch {
        // één mislukte dag mag de rest niet blokkeren; gewoon verder gaan
      }
      done++;
    }

    setSubmitting(false);
    setProgress(null);
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-hairline rounded-2xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-xl mb-1">Vakantie inplannen</h2>
        <p className="text-cream/40 text-sm mb-5">
          Blokkeert de agenda voor de gekozen periode, zodat er niets geboekt
          kan worden.
        </p>

        <div className="grid grid-cols-3 gap-1.5 mb-5">
          {(["halve_dag", "dagen", "weken"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`py-2 rounded-lg border text-xs transition ${
                mode === m
                  ? "bg-gold-gradient text-deep font-semibold border-transparent"
                  : "border-hairline hover:border-gold"
              }`}
            >
              {m === "halve_dag" ? "Halve dag" : m === "dagen" ? "Dag(en)" : "Week(en)"}
            </button>
          ))}
        </div>

        {mode === "halve_dag" && (
          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-xs text-cream/50 mb-1">Datum</label>
              <input
                type="date"
                value={halfDayDate}
                onChange={(e) => setHalfDayDate(e.target.value)}
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold [color-scheme:dark]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setHalfDayPart("voormiddag")}
                className={`py-2 rounded-lg border text-sm transition ${
                  halfDayPart === "voormiddag"
                    ? "bg-gold-gradient text-deep font-semibold border-transparent"
                    : "border-hairline hover:border-gold"
                }`}
              >
                Voormiddag
              </button>
              <button
                onClick={() => setHalfDayPart("namiddag")}
                className={`py-2 rounded-lg border text-sm transition ${
                  halfDayPart === "namiddag"
                    ? "bg-gold-gradient text-deep font-semibold border-transparent"
                    : "border-hairline hover:border-gold"
                }`}
              >
                Namiddag
              </button>
            </div>
          </div>
        )}

        {mode === "dagen" && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <label className="block text-xs text-cream/50 mb-1">Van</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Tot en met</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold [color-scheme:dark]"
              />
            </div>
          </div>
        )}

        {mode === "weken" && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <label className="block text-xs text-cream/50 mb-1">Startdatum</label>
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Aantal weken</label>
              <input
                type="number"
                min={1}
                max={12}
                value={weekCount}
                onChange={(e) => setWeekCount(Number(e.target.value))}
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
              />
            </div>
          </div>
        )}

        <div className="mb-5">
          <label className="block text-xs text-cream/50 mb-1">Notitie</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
          />
        </div>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        {progress && (
          <p className="text-xs text-cream/40 mb-3">Bezig met blokkeren... {progress}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-full border border-hairline hover:border-gold transition text-sm disabled:opacity-40"
          >
            Annuleren
          </button>
          <button
            disabled={submitting}
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-full bg-gold-gradient text-deep font-semibold text-sm disabled:opacity-40 transition"
          >
            {submitting ? "Bezig..." : "Blokkeren"}
          </button>
        </div>
      </div>
    </div>
  );
}
