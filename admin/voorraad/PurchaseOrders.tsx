"use client";

import { useEffect, useState } from "react";
import { Product, PurchaseOrder } from "@/lib/types";
import NewPurchaseOrderModal from "./NewPurchaseOrderModal";
import CancelOrderReasonModal from "./CancelOrderReasonModal";

function eur(n: number) {
  return `€${n.toFixed(2)}`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("nl-BE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Brussels",
  });
}

const STATUS_LABEL: Record<PurchaseOrder["status"], string> = {
  besteld: "Besteld",
  ontvangen: "Ontvangen",
  geannuleerd: "Geannuleerd",
};

export default function PurchaseOrders({ products }: { products: Product[] }) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<PurchaseOrder | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/purchase-orders")
      .then((r) => r.json())
      .then((data) => {
        setOrders(data);
        setLoading(false);
      });
  }

  useEffect(load, []);

  const pending = orders.filter((o) => o.status === "besteld");
  const history = orders.filter((o) => o.status !== "besteld");

  function orderTotal(o: PurchaseOrder) {
    return o.items.reduce((sum, it) => sum + (it.unitCost || 0) * it.quantity, 0);
  }

  async function receiveOrder(o: PurchaseOrder) {
    if (!confirm(`Bestelling "${o.supplier || "zonder leverancier"}" ontvangen en verwerken in stock + cijfers?`)) {
      return;
    }
    setBusyId(o.id);
    setError(null);
    const res = await fetch(`/api/purchase-orders/${o.id}/receive`, { method: "POST" });
    setBusyId(null);
    if (!res.ok) {
      setError("Afronden is mislukt. Probeer opnieuw.");
      return;
    }
    load();
  }

  async function deleteOrder(o: PurchaseOrder) {
    if (!confirm("Deze bestelling volledig verwijderen uit de lijst?")) return;
    setBusyId(o.id);
    const res = await fetch(`/api/purchase-orders/${o.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) setError("Verwijderen is mislukt.");
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-cream/40 text-sm">
          Zet een bestelling klaar bij een leverancier; ze komt pas in de
          stock en de cijfers terecht als je ze ontvangt en afrondt.
        </p>
        <button
          onClick={() => setShowNew(true)}
          className="text-xs px-4 py-2 rounded-full bg-gold-gradient text-deep font-semibold shrink-0 ml-4"
        >
          + Nieuwe bestelling
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-cream/40 text-sm">Laden...</p>
      ) : (
        <>
          <h2 className="text-xs text-gold/80 uppercase tracking-wide mb-2">
            Openstaand ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <p className="text-cream/40 text-sm mb-6">Geen openstaande bestellingen.</p>
          ) : (
            <ul className="space-y-2 mb-6">
              {pending.map((o) => (
                <li
                  key={o.id}
                  className="px-4 py-3 rounded-xl border border-hairline bg-panel/30"
                >
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <p className="text-sm font-semibold">
                      {o.supplier || "Bestelling"}{" "}
                      <span className="text-cream/40 font-normal">
                        &middot; {formatDateTime(o.createdAt)}
                      </span>
                    </p>
                    <p className="text-sm text-gold-light shrink-0">{eur(orderTotal(o))}</p>
                  </div>
                  <ul className="text-xs text-cream/50 mb-3">
                    {o.items.map((it, i) => (
                      <li key={i}>
                        {it.quantity}x {it.productName}
                        {it.unitCost !== undefined && ` — ${eur(it.unitCost)}/stuk`}
                      </li>
                    ))}
                  </ul>
                  {o.notes && (
                    <p className="text-[11px] text-cream/30 italic mb-3">{o.notes}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      disabled={busyId === o.id}
                      onClick={() => receiveOrder(o)}
                      className="text-xs px-3 py-1.5 rounded-full bg-gold-gradient text-deep font-semibold disabled:opacity-40"
                    >
                      Ontvangen &amp; afronden
                    </button>
                    <button
                      disabled={busyId === o.id}
                      onClick={() => setCancelTarget(o)}
                      className="text-xs px-3 py-1.5 rounded-full border border-hairline hover:border-red-700 hover:text-red-400 transition disabled:opacity-40"
                    >
                      Annuleren
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {history.length > 0 && (
            <div className="pt-3 border-t border-hairline/50">
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="text-xs text-cream/40 hover:text-cream/70 transition flex items-center gap-1.5 mb-2"
              >
                <span aria-hidden>{showHistory ? "▾" : "▸"}</span>
                Geschiedenis ({history.length})
              </button>
              {showHistory && (
                <ul className="space-y-2">
                  {history.map((o) => (
                    <li
                      key={o.id}
                      className="px-4 py-3 rounded-xl border border-dashed border-hairline/60 bg-panel/10"
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <p className="text-sm text-cream/60">
                          {o.supplier || "Bestelling"}{" "}
                          <span className="text-cream/35">
                            &middot; {formatDateTime(o.createdAt)}
                          </span>
                        </p>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full border ${
                            o.status === "ontvangen"
                              ? "border-emerald-700/50 text-emerald-300"
                              : "border-red-800/50 text-red-400"
                          }`}
                        >
                          {STATUS_LABEL[o.status]}
                        </span>
                      </div>
                      <ul className="text-xs text-cream/40 mb-1.5">
                        {o.items.map((it, i) => (
                          <li key={i}>
                            {it.quantity}x {it.productName}
                          </li>
                        ))}
                      </ul>
                      {o.status === "geannuleerd" && o.cancelReason && (
                        <p className="text-[11px] text-cream/30 italic">
                          Reden: {o.cancelReason}
                        </p>
                      )}
                      {o.status === "geannuleerd" && (
                        <button
                          onClick={() => deleteOrder(o)}
                          className="text-[11px] text-cream/30 hover:text-red-400 mt-1.5"
                        >
                          Verwijderen uit lijst
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {showNew && (
        <NewPurchaseOrderModal
          products={products}
          onClose={() => setShowNew(false)}
          onDone={() => {
            setShowNew(false);
            load();
          }}
        />
      )}

      {cancelTarget && (
        <CancelOrderReasonModal
          supplier={cancelTarget.supplier}
          onClose={() => setCancelTarget(null)}
          onConfirm={async (reason) => {
            setBusyId(cancelTarget.id);
            const res = await fetch(`/api/purchase-orders/${cancelTarget.id}/cancel`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason }),
            });
            setBusyId(null);
            if (!res.ok) setError("Annuleren is mislukt.");
            setCancelTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}
