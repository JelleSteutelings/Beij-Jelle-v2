"use client";

import { useState } from "react";
import { Product, StockMovementType } from "@/lib/types";

const TYPE_LABEL: Record<StockMovementType, string> = {
  in: "Inkomend (aankoop)",
  sold: "Verkocht aan klant",
  used: "Verbruikt (werkmateriaal)",
};

export default function StockMovementModal({
  product,
  onClose,
  onDone,
}: {
  product: Product;
  onClose: () => void;
  onDone: () => void;
}) {
  const [type, setType] = useState<StockMovementType>("in");
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(product.costPrice ?? 0);
  const [unitPrice, setUnitPrice] = useState(product.salePrice ?? 0);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (quantity <= 0) {
      setError("Geef een aantal groter dan 0 op.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/products/${product.id}/movements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        quantity,
        unitCost: type === "in" ? unitCost : undefined,
        unitPrice: type === "sold" ? unitPrice : undefined,
        note,
      }),
    });
    setSubmitting(false);
    if (res.ok) onDone();
    else setError("Er ging iets mis. Probeer opnieuw.");
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-hairline rounded-2xl w-full max-w-sm p-6">
        <h2 className="font-display text-lg mb-0.5">Voorraadbeweging</h2>
        <p className="text-xs text-cream/40 mb-5">{product.name}</p>

        <div className="grid grid-cols-1 gap-1.5 mb-4">
          {(Object.keys(TYPE_LABEL) as StockMovementType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`text-left px-3.5 py-2 rounded-lg border text-sm transition ${
                type === t
                  ? "bg-gold-gradient text-deep font-semibold border-transparent"
                  : "border-hairline hover:border-gold"
              }`}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-cream/50 mb-1">
              Aantal ({product.unit})
            </label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          {type === "in" && (
            <div>
              <label className="block text-xs text-cream/50 mb-1">
                Aankoopprijs / eenheid
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(Number(e.target.value))}
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
              />
            </div>
          )}
          {type === "sold" && (
            <div>
              <label className="block text-xs text-cream/50 mb-1">
                Verkoopprijs / eenheid
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
              />
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-xs text-cream/50 mb-1">
            Notitie (optioneel)
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              type === "used" ? "bv. gebruikt bij kleuring klant X" : ""
            }
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
            {submitting ? "Bezig..." : "Registreren"}
          </button>
        </div>
      </div>
    </div>
  );
}
