"use client";

import { useState } from "react";
import { Product, PurchaseOrderItem } from "@/lib/types";

type DraftItem = {
  productId: string; // "" = nieuw product (vrije naam)
  productName: string;
  quantity: number;
  unitCost: string;
};

function emptyItem(): DraftItem {
  return { productId: "", productName: "", quantity: 1, unitCost: "" };
}

export default function NewPurchaseOrderModal({
  products,
  onClose,
  onDone,
}: {
  products: Product[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [supplier, setSupplier] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addRow() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeRow(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setError(null);
    const cleaned = items
      .map((it) => ({ ...it, productName: it.productName.trim() }))
      .filter((it) => it.productName && it.quantity > 0);

    if (cleaned.length === 0) {
      setError("Voeg minstens één product met een aantal toe.");
      return;
    }

    const payloadItems: PurchaseOrderItem[] = cleaned.map((it) => ({
      productId: it.productId || undefined,
      productName: it.productName,
      quantity: it.quantity,
      unitCost: it.unitCost.trim() ? Number(it.unitCost) : undefined,
    }));

    setSubmitting(true);
    const res = await fetch("/api/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier: supplier.trim() || undefined,
        items: payloadItems,
        notes: notes.trim() || undefined,
      }),
    });
    setSubmitting(false);
    if (res.ok) onDone();
    else setError("Er ging iets mis. Je gegevens staan nog klaar — probeer opnieuw.");
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-hairline rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-xl mb-1">Bestelling klaarzetten</h2>
        <p className="text-cream/40 text-sm mb-5">
          Komt pas in de stock en de cijfers terecht als je ze later afrondt.
        </p>

        <div className="mb-4">
          <label className="block text-xs text-cream/50 mb-1.5">Leverancier (optioneel)</label>
          <input
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
          />
        </div>

        <label className="block text-xs text-cream/50 mb-1.5">Producten</label>
        <div className="space-y-2 mb-2">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={it.productId}
                onChange={(e) => {
                  const p = products.find((p) => p.id === e.target.value);
                  updateItem(i, {
                    productId: e.target.value,
                    productName: p ? p.name : it.productName,
                    unitCost: p?.costPrice !== undefined ? String(p.costPrice) : it.unitCost,
                  });
                }}
                className="w-40 shrink-0 bg-deep border border-hairline rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-gold"
              >
                <option value="">+ Nieuw product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {!it.productId && (
                <input
                  value={it.productName}
                  onChange={(e) => updateItem(i, { productName: e.target.value })}
                  placeholder="Naam nieuw product"
                  className="flex-1 min-w-0 bg-deep border border-hairline rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-gold"
                />
              )}
              <input
                type="number"
                min={1}
                value={it.quantity}
                onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                title="Aantal"
                className="w-16 shrink-0 bg-deep border border-hairline rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:border-gold"
              />
              <input
                type="number"
                min={0}
                step={0.01}
                value={it.unitCost}
                onChange={(e) => updateItem(i, { unitCost: e.target.value })}
                placeholder="€/stuk"
                title="Aankoopprijs per eenheid"
                className="w-20 shrink-0 bg-deep border border-hairline rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-gold"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={items.length === 1}
                className="text-cream/30 hover:text-red-400 disabled:opacity-20 shrink-0 px-1"
                title="Verwijder rij"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="text-xs text-gold/80 hover:text-gold mb-5"
        >
          + Nog een product toevoegen
        </button>

        <div className="mb-5">
          <label className="block text-xs text-cream/50 mb-1.5">Opmerking (optioneel)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
          />
        </div>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full border border-hairline hover:border-gold transition text-sm"
          >
            Annuleren
          </button>
          <button
            disabled={submitting}
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-full bg-gold-gradient text-deep font-semibold text-sm disabled:opacity-40 transition"
          >
            {submitting ? "Bezig..." : "Bestelling klaarzetten"}
          </button>
        </div>
      </div>
    </div>
  );
}
