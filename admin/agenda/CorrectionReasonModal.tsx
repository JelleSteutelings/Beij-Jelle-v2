"use client";

import { useState } from "react";

export default function CorrectionReasonModal({
  customerName,
  total,
  onClose,
  onConfirm,
}: {
  customerName: string;
  total: number;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-hairline rounded-2xl w-full max-w-sm p-6">
        <h2 className="font-display text-lg mb-1">Kassaverrichting corrigeren</h2>
        <p className="text-cream/40 text-sm mb-5">
          {customerName} — &euro;{total.toFixed(2)}
        </p>

        <div className="text-xs text-amber-300/90 bg-amber-950/20 border border-amber-800/40 rounded-lg p-3 mb-5 space-y-1.5">
          <p>Dit verwijdert de afspraak en de verkoop volledig:</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-300/70">
            <li>verdwijnt uit de agenda</li>
            <li>verdwijnt uit de dagontvangsten en rapportages</li>
            <li>voorraad en cadeaubon-saldo worden teruggedraaid</li>
          </ul>
          <p>
            Dit blijft wel bewaard in een intern correctielogje (enkel voor
            jou zichtbaar, bv. bij Cash) — daarom is een reden verplicht.
          </p>
        </div>

        <label className="block text-xs text-cream/50 mb-1.5">
          Reden (verplicht)
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="bv. verkeerd aangerekend, dubbel ingegeven..."
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
            className="flex-1 py-2.5 rounded-full bg-gold-gradient text-deep font-semibold text-sm transition disabled:opacity-40"
          >
            {confirming ? "Bezig..." : "Corrigeren bevestigen"}
          </button>
        </div>
      </div>
    </div>
  );
}
