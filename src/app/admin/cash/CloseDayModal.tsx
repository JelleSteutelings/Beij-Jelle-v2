"use client";

import { useState } from "react";

export default function CloseDayModal({
  dateLabel,
  salesCount,
  total,
  onClose,
  onConfirm,
}: {
  dateLabel: string;
  salesCount: number;
  total: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-hairline rounded-2xl w-full max-w-sm p-6">
        <h2 className="font-display text-lg mb-1">Dag definitief afsluiten</h2>
        <p className="text-cream/40 text-sm mb-5">{dateLabel}</p>

        <div className="text-xs text-amber-300/90 bg-amber-950/20 border border-amber-800/40 rounded-lg p-3 mb-5 space-y-1.5">
          <p>
            {salesCount} verrichting{salesCount === 1 ? "" : "en"} &middot; totaal &euro;
            {total.toFixed(2)}
          </p>
          <p>Na het afsluiten:</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-300/70">
            <li>kan &ldquo;Kassa aanpassen&rdquo; niet meer voor deze dag</li>
            <li>kunnen er geen nieuwe verrichtingen meer bijkomen voor deze dag</li>
            <li>blijft corrigeren (met reden) via de agenda nog wel mogelijk</li>
          </ul>
          <p>
            Per ongeluk te vroeg afgesloten? Dat kan achteraf hier bij Cash
            heropend worden, met wachtwoord.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full border border-hairline hover:border-gold transition text-sm"
          >
            Terug
          </button>
          <button
            disabled={confirming}
            onClick={() => {
              setConfirming(true);
              onConfirm();
            }}
            className="flex-1 py-2.5 rounded-full bg-gold-gradient text-deep font-semibold text-sm transition disabled:opacity-40"
          >
            {confirming ? "Bezig..." : "Definitief afsluiten"}
          </button>
        </div>
      </div>
    </div>
  );
}
