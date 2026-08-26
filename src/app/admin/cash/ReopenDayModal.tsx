"use client";

import { useState } from "react";

export default function ReopenDayModal({
  dateLabel,
  onClose,
  onConfirm,
}: {
  dateLabel: string;
  onClose: () => void;
  onConfirm: (password: string, reason: string) => Promise<string | null>;
}) {
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    const err = await onConfirm(password, reason.trim());
    setSubmitting(false);
    if (err) setError(err);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-hairline rounded-2xl w-full max-w-sm p-6">
        <h2 className="font-display text-lg mb-1">Dag heropenen</h2>
        <p className="text-cream/40 text-sm mb-5">{dateLabel}</p>

        <p className="text-xs text-cream/50 mb-4">
          Extra wachtwoordcontrole, zoals bij Correcties &mdash; en een reden,
          zodat er altijd terug te vinden is waarom deze dag heropend werd.
        </p>

        <label className="block text-xs text-cream/50 mb-1.5">Wachtwoord</label>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-gold"
        />

        <label className="block text-xs text-cream/50 mb-1.5">
          Reden (verplicht)
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="bv. te vroeg afgesloten, klant kwam nog binnen..."
          className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm mb-5 focus:outline-none focus:border-gold"
        />

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full border border-hairline hover:border-gold transition text-sm"
          >
            Terug
          </button>
          <button
            disabled={submitting || !password || !reason.trim()}
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-full bg-gold-gradient text-deep font-semibold text-sm transition disabled:opacity-40"
          >
            {submitting ? "Bezig..." : "Heropenen bevestigen"}
          </button>
        </div>
      </div>
    </div>
  );
}
