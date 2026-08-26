"use client";

import { useState } from "react";
import { Product } from "@/lib/types";

export default function EditProductModal({
  product,
  onClose,
  onDone,
}: {
  product: Product;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [minStock, setMinStock] = useState(product.minStock);
  const [unit, setUnit] = useState(product.unit);
  const [costPrice, setCostPrice] = useState(
    product.costPrice !== undefined ? String(product.costPrice) : ""
  );
  const [salePrice, setSalePrice] = useState(
    product.salePrice !== undefined ? String(product.salePrice) : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("Naam mag niet leeg zijn.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        minStock,
        unit,
        costPrice: costPrice !== "" ? Number(costPrice) : undefined,
        salePrice: salePrice !== "" ? Number(salePrice) : undefined,
      }),
    });
    setSubmitting(false);
    if (res.ok) onDone();
    else setError("Er ging iets mis. Probeer opnieuw.");
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-hairline rounded-2xl w-full max-w-sm p-6">
        <h2 className="font-display text-lg mb-1">Product bewerken</h2>
        <p className="text-xs text-cream/40 mb-5">
          Huidige voorraad ({product.stock} {product.unit}) pas je aan via
          &ldquo;Beweging&rdquo;, niet hier.
        </p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs text-cream/50 mb-1">Naam</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream/50 mb-1">Minimum</label>
              <input
                type="number"
                min={0}
                value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Eenheid</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream/50 mb-1">Aankoopprijs</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="€"
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Verkoopprijs</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="€"
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
              />
            </div>
          </div>
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
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-full bg-gold-gradient text-deep font-semibold text-sm disabled:opacity-40 transition"
          >
            {submitting ? "Bezig..." : "Opslaan"}
          </button>
        </div>
      </div>
    </div>
  );
}
