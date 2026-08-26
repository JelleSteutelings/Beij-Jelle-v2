"use client";

import { useEffect, useState } from "react";
import { Product, StockMovement } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  in: "Inkomend",
  sold: "Verkocht",
  used: "Verbruikt",
};

const TYPE_STYLE: Record<string, string> = {
  in: "bg-emerald-900/40 text-emerald-300 border-emerald-700/50",
  sold: "bg-blue-900/40 text-blue-300 border-blue-700/50",
  used: "bg-amber-900/40 text-amber-300 border-amber-700/50",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InventoryLedger() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<"all" | "in" | "sold" | "used">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/stock-movements").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ]).then(([movementsData, productsData]) => {
      setMovements(movementsData);
      setProducts(productsData);
      setLoading(false);
    });
  }, []);

  const productById = (id: string) => products.find((p) => p.id === id) || null;

  async function deleteMovement(id: string) {
    if (
      !confirm(
        "Deze beweging verwijderen? De voorraad wordt automatisch teruggedraaid."
      )
    )
      return;
    await fetch(`/api/stock-movements/${id}`, { method: "DELETE" });
    setMovements((prev) => prev.filter((m) => m.id !== id));
    fetch("/api/products")
      .then((r) => r.json())
      .then(setProducts);
  }

  const filtered =
    filter === "all" ? movements : movements.filter((m) => m.type === filter);

  const totalStockValue = products.reduce(
    (sum, p) => sum + (p.costPrice || 0) * p.stock,
    0
  );

  const totals = {
    in: movements
      .filter((m) => m.type === "in")
      .reduce((sum, m) => sum + m.quantity * (m.unitCost || 0), 0),
    sold: movements
      .filter((m) => m.type === "sold")
      .reduce((sum, m) => sum + m.quantity * (m.unitPrice || 0), 0),
    used: movements.filter((m) => m.type === "used").reduce((sum, m) => sum + m.quantity, 0),
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs text-gold/80 uppercase tracking-wide">
          Huidige voorraad
        </h3>
        {!loading && products.some((p) => p.costPrice !== undefined) && (
          <p className="text-xs text-cream/50">
            Totale aankoopwaarde:{" "}
            <span className="font-display text-gold-light">
              &euro;{totalStockValue.toFixed(2)}
            </span>
          </p>
        )}
      </div>
      {loading ? (
        <p className="text-cream/40 text-sm mb-6">Laden...</p>
      ) : products.length === 0 ? (
        <p className="text-cream/40 text-sm mb-6">Nog geen producten.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2 mb-6">
          {products.map((p) => {
            const low = p.stock <= p.minStock;
            const value =
              p.costPrice !== undefined ? p.costPrice * p.stock : null;
            return (
              <div
                key={p.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${
                  low
                    ? "border-amber-700/50 bg-amber-950/20"
                    : "border-hairline bg-panel/30"
                }`}
              >
                <span className="truncate text-cream/80">{p.name}</span>
                <span className="text-right shrink-0 ml-2">
                  <span
                    className={`font-display block ${
                      low ? "text-amber-300" : "text-gold-light"
                    }`}
                  >
                    {p.stock} {p.unit}
                  </span>
                  {value !== null && (
                    <span className="text-xs text-cream/70 block">
                      &euro;{value.toFixed(2)} aankoopwaarde
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="border border-hairline rounded-xl p-3 bg-panel/30">
          <p className="text-[11px] text-cream/40 mb-1">Aankopen (totaal)</p>
          <p className="font-display text-gold-light text-lg">&euro;{totals.in.toFixed(2)}</p>
        </div>
        <div className="border border-hairline rounded-xl p-3 bg-panel/30">
          <p className="text-[11px] text-cream/40 mb-1">Verkocht aan klanten</p>
          <p className="font-display text-gold-light text-lg">&euro;{totals.sold.toFixed(2)}</p>
        </div>
        <div className="border border-hairline rounded-xl p-3 bg-panel/30">
          <p className="text-[11px] text-cream/40 mb-1">Eenheden verbruikt</p>
          <p className="font-display text-gold-light text-lg">{totals.used}</p>
        </div>
      </div>

      <div className="flex gap-1.5 mb-4">
        {(["all", "in", "sold", "used"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3.5 py-1.5 rounded-full border transition ${
              filter === f
                ? "bg-gold-gradient text-deep font-semibold border-transparent"
                : "border-hairline text-cream/60 hover:border-gold"
            }`}
          >
            {f === "all" ? "Alles" : TYPE_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-cream/40 text-sm">Laden...</p>
      ) : filtered.length === 0 ? (
        <p className="text-cream/40 text-sm">Nog geen voorraadbewegingen.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-hairline bg-panel/30"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${TYPE_STYLE[m.type]}`}
                  >
                    {TYPE_LABEL[m.type]}
                  </span>
                  <p className="text-sm truncate">{m.productName}</p>
                  {productById(m.productId) && (
                    <span className="text-xs text-cream/55 shrink-0">
                      (nu: {productById(m.productId)?.stock}{" "}
                      {productById(m.productId)?.unit})
                    </span>
                  )}
                </div>
                <p className="text-xs text-cream/40 mt-1">
                  {formatDateTime(m.createdAt)}
                  {m.note ? ` · ${m.note}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0 flex items-center gap-3">
                <div>
                  <p className="text-sm">
                    {m.type === "in" ? "+" : "−"}
                    {m.quantity}
                  </p>
                  {m.type === "in" && m.unitCost !== undefined && (
                    <p className="text-xs text-cream/65">
                      &euro;{(m.unitCost * m.quantity).toFixed(2)}
                    </p>
                  )}
                  {m.type === "sold" && m.unitPrice !== undefined && (
                    <p className="text-xs text-cream/65">
                      &euro;{(m.unitPrice * m.quantity).toFixed(2)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => deleteMovement(m.id)}
                  className="text-cream/25 hover:text-red-400 text-xs px-1"
                  title="Verwijderen"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
