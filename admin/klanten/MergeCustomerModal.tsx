"use client";

import { useState } from "react";
import { Customer } from "@/lib/types";

export default function MergeCustomerModal({
  primary,
  allCustomers,
  onClose,
  onDone,
}: {
  primary: Customer;
  allCustomers: Customer[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [search, setSearch] = useState("");
  const [duplicate, setDuplicate] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = allCustomers.filter(
    (c) =>
      c.id !== primary.id &&
      (c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search))
  );

  async function handleMerge() {
    if (!duplicate) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/customers/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryId: primary.id, duplicateId: duplicate.id }),
    });
    setSubmitting(false);
    if (res.ok) {
      onDone();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Er ging iets mis.");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-hairline rounded-2xl w-full max-w-sm p-6">
        <h2 className="font-display text-lg mb-1">Dubbele klant samenvoegen</h2>
        <p className="text-xs text-cream/40 mb-5">
          Alle afspraken, verkopen en cadeaubonnen van de foute/dubbele klant
          worden overgezet naar <strong className="text-cream/70">{primary.name}</strong>,
          waarna de dubbele klant verwijderd wordt.
        </p>

        {!duplicate ? (
          <>
            <label className="block text-xs text-cream/50 mb-1.5">
              Zoek de foute/dubbele klant
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="naam of gsm..."
              autoFocus
              className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-gold"
            />
            <div className="max-h-48 overflow-y-auto space-y-1.5 mb-4">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setDuplicate(c)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-hairline hover:border-gold transition text-sm"
                >
                  <p>{c.name}</p>
                  <p className="text-xs text-cream/40">{c.phone}</p>
                </button>
              ))}
              {search && candidates.length === 0 && (
                <p className="text-xs text-cream/40">Geen klanten gevonden.</p>
              )}
            </div>
          </>
        ) : (
          <div className="mb-4 p-3 rounded-lg border border-amber-700/50 bg-amber-950/20">
            <p className="text-sm mb-1">
              <span className="text-red-400">{duplicate.name}</span> ({duplicate.phone})
            </p>
            <p className="text-xs text-cream/50 mb-2">
              wordt samengevoegd met en verwijderd, alles komt bij{" "}
              <span className="text-emerald-300">{primary.name}</span> terecht.
            </p>
            <button
              onClick={() => setDuplicate(null)}
              className="text-[11px] text-cream/40 hover:text-gold underline underline-offset-2"
            >
              andere klant kiezen
            </button>
          </div>
        )}

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full border border-hairline hover:border-gold transition text-sm"
          >
            Annuleren
          </button>
          <button
            disabled={!duplicate || submitting}
            onClick={handleMerge}
            className="flex-1 py-2.5 rounded-full bg-gold-gradient text-deep font-semibold text-sm disabled:opacity-40 transition"
          >
            {submitting ? "Bezig..." : "Samenvoegen"}
          </button>
        </div>
      </div>
    </div>
  );
}
