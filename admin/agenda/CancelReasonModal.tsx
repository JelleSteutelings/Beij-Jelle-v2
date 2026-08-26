"use client";

import { useState } from "react";

export default function CancelReasonModal({
  customerName,
  onClose,
  onConfirm,
}: {
  customerName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-hairline rounded-2xl w-full max-w-sm p-6">
        <h2 className="font-display text-lg mb-1">Afspraak annuleren</h2>
        <p className="text-cream/40 text-sm mb-5">{customerName}</p>

        <label className="block text-xs text-cream/50 mb-1.5">
          Reden (optioneel)
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="bv. ziek, verhinderd, andere afspraak..."
          autoFocus
          className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm mb-5 focus:outline-none focus:border-gold"
        />
        <p className="text-[11px] text-cream/30 mb-5">
          Dit tijdstip komt vrij en kan meteen aan iemand anders gegeven
          worden — dit is dus iets anders dan een no-show.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full border border-hairline hover:border-gold transition text-sm"
          >
            Terug
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className="flex-1 py-2.5 rounded-full bg-gold-gradient text-deep font-semibold text-sm transition"
          >
            Annuleren bevestigen
          </button>
        </div>
      </div>
    </div>
  );
}
