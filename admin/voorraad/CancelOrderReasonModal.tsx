"use client";

import { useState } from "react";

export default function CancelOrderReasonModal({
  supplier,
  onClose,
  onConfirm,
}: {
  supplier?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-hairline rounded-2xl w-full max-w-sm p-6">
        <h2 className="font-display text-lg mb-1">Bestelling annuleren</h2>
        <p className="text-cream/40 text-sm mb-5">{supplier || "Deze bestelling"}</p>

        <p className="text-[11px] text-cream/40 mb-4">
          Enkel bedoeld voor bestellingen die uiteindelijk niet geleverd zijn
          (verkeerd besteld, leverancier annuleerde, ...). Kwam de bestelling
          wél binnen, gebruik dan &ldquo;Ontvangen &amp; afronden&rdquo; in plaats
          van te annuleren.
        </p>

        <label className="block text-xs text-cream/50 mb-1.5">Reden (verplicht)</label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="bv. verkeerd besteld, leverancier annuleerde..."
          autoFocus
          className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm mb-5 focus:outline-none focus:border-gold"
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full border border-hairline hover:border-gold transition text-sm"
          >
            Terug
          </button>
          <button
            disabled={!reason.trim() || confirming}
            onClick={() => {
              setConfirming(true);
              onConfirm(reason.trim());
            }}
            className="flex-1 py-2.5 rounded-full bg-gold-gradient text-deep font-semibold text-sm disabled:opacity-40 transition"
          >
            {confirming ? "Bezig..." : "Annuleren bevestigen"}
          </button>
        </div>
      </div>
    </div>
  );
}
