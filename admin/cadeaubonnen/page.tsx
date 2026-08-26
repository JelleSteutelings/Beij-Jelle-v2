"use client";

import { useEffect, useState } from "react";
import { Customer, GiftVoucher } from "@/lib/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CadeaubonnenPage() {
  const [vouchers, setVouchers] = useState<GiftVoucher[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [origin, setOrigin] = useState<"paid" | "sponsoring">("paid");
  const [customerId, setCustomerId] = useState("");
  const [note, setNote] = useState("");
  const [issuedAt, setIssuedAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetch("/api/gift-vouchers")
      .then((r) => r.json())
      .then(setVouchers);
  }

  useEffect(() => {
    load();
    fetch("/api/customers").then((r) => r.json()).then(setCustomers);
  }, []);

  function suggestCode() {
    const n = vouchers.length + 1;
    return `CB${String(n).padStart(4, "0")}`;
  }

  async function createVoucher() {
    if (!code.trim() || !amount) {
      setError("Geef een code en een bedrag op.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const customer = customers.find((c) => c.id === customerId);
    const res = await fetch("/api/gift-vouchers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.trim(),
        amount: Number(amount),
        customerId: customerId || undefined,
        customerName: customer?.name,
        note,
        issuedAt: new Date(issuedAt).toISOString(),
        origin,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      setCode("");
      setAmount("");
      setCustomerId("");
      setNote("");
      setOrigin("paid");
      setShowNew(false);
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Er ging iets mis.");
    }
  }

  async function removeVoucher(id: string) {
    if (!confirm("Deze cadeaubon verwijderen?")) return;
    await fetch(`/api/gift-vouchers/${id}`, { method: "DELETE" });
    load();
  }

  const active = vouchers.filter((v) => v.remainingAmount > 0);
  const used = vouchers.filter((v) => v.remainingAmount <= 0);

  return (
    <div className="p-6 sm:p-10 max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl">Cadeaubonnen</h1>
        <button
          onClick={() => {
            setShowNew((v) => !v);
            if (!code) setCode(suggestCode());
          }}
          className="text-xs border border-hairline hover:border-gold rounded-full px-4 py-2 transition"
        >
          + Cadeaubon registreren
        </button>
      </div>
      <p className="text-cream/40 text-sm mb-6">
        Cadeaubonnen worden buiten de app uitgeschreven (bv. op papier) — hier
        registreer je enkel het bedrag, zodat het bij de kassa gebruikt kan
        worden.
      </p>

      {showNew && (
        <div className="mb-6 p-4 border border-hairline rounded-xl bg-panel/40 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream/50 mb-1">Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="bv. CB0001"
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Bedrag</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="€"
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream/50 mb-1">
                Klant (optioneel)
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
              >
                <option value="">— geen —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">
                Uitgiftedatum
              </label>
              <input
                type="date"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold [color-scheme:dark]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Herkomst</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOrigin("paid")}
                className={`py-2 rounded-lg border text-sm transition ${
                  origin === "paid"
                    ? "bg-gold-gradient text-deep font-semibold border-transparent"
                    : "border-hairline hover:border-gold"
                }`}
              >
                Betaald door klant
              </button>
              <button
                type="button"
                onClick={() => setOrigin("sponsoring")}
                className={`py-2 rounded-lg border text-sm transition ${
                  origin === "sponsoring"
                    ? "bg-gold-gradient text-deep font-semibold border-transparent"
                    : "border-hairline hover:border-gold"
                }`}
              >
                Gratis (sponsoring)
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">
              Notitie (optioneel)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="bv. verjaardagscadeau"
              className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            disabled={submitting}
            onClick={createVoucher}
            className="text-xs px-4 py-2 rounded-full bg-gold-gradient text-deep font-semibold disabled:opacity-40"
          >
            {submitting ? "Bezig..." : "Registreren"}
          </button>
        </div>
      )}

      <h2 className="text-xs text-gold/80 uppercase tracking-wide mb-2">
        Openstaand ({active.length})
      </h2>
      <ul className="space-y-2 mb-8">
        {active.map((v) => (
          <li
            key={v.id}
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-hairline bg-panel/30"
          >
            <div className="min-w-0">
              <p className="text-sm flex items-center gap-2">
                {v.code}
                {v.customerName ? ` — ${v.customerName}` : ""}
                {v.origin === "sponsoring" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-950/40 text-purple-300 border border-purple-800/50 shrink-0">
                    sponsoring
                  </span>
                )}
              </p>
              <p className="text-xs text-cream/40">
                Uitgegeven {formatDate(v.issuedAt)}
                {v.note ? ` · ${v.note}` : ""}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-display text-gold-light">
                &euro;{v.remainingAmount.toFixed(2)}
              </p>
              {v.remainingAmount < v.originalAmount && (
                <p className="text-[11px] text-cream/40">
                  van &euro;{v.originalAmount.toFixed(2)}
                </p>
              )}
            </div>
            <button
              onClick={() => removeVoucher(v.id)}
              className="text-xs text-cream/30 hover:text-red-400 px-1 shrink-0"
            >
              verwijderen
            </button>
          </li>
        ))}
        {active.length === 0 && (
          <p className="text-cream/40 text-sm">Geen openstaande cadeaubonnen.</p>
        )}
      </ul>

      {used.length > 0 && (
        <>
          <h2 className="text-xs text-gold/80 uppercase tracking-wide mb-2">
            Volledig gebruikt ({used.length})
          </h2>
          <ul className="space-y-2">
            {used.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-hairline bg-panel/20 opacity-50"
              >
                <div className="min-w-0">
                  <p className="text-sm line-through">
                    {v.code}
                    {v.customerName ? ` — ${v.customerName}` : ""}
                  </p>
                  <p className="text-xs text-cream/40">
                    Uitgegeven {formatDate(v.issuedAt)}
                  </p>
                </div>
                <p className="text-sm text-cream/40 shrink-0">
                  &euro;{v.originalAmount.toFixed(2)} gebruikt
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
