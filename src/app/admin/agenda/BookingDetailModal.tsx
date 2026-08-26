"use client";

import { useEffect, useState } from "react";
import { Booking, Customer, Service } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Bevestigd",
  pending: "Aanvraag",
  done: "Afgerond",
  cancelled: "Geannuleerd",
  blocked: "Geblokkeerd",
  no_show: "No show",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Brussels",
  });
}

export default function BookingDetailModal({
  booking,
  service,
  isDayClosed,
  onClose,
  onCheckout,
  onCancel,
  onNoShow,
  onRevertNoShow,
  onConfirm,
  onDelete,
  onQuickDeleteSale,
  onCorrect,
}: {
  booking: Booking;
  service: Service | null;
  /** Of de dag van de kassaverrichting bij deze afspraak al definitief is
   * afgesloten (enkel relevant voor status "done"). Zolang dat niet zo is,
   * kan de verrichting nog vrij aangepast/verwijderd worden — pas na
   * afsluiten wordt een reden verplicht en blijft het bewaard in het
   * correctielogje. */
  isDayClosed?: boolean;
  onClose: () => void;
  onCheckout: () => void;
  onCancel: () => void;
  onNoShow: () => void;
  onRevertNoShow: () => void;
  onConfirm: () => void;
  onDelete: () => void;
  onQuickDeleteSale?: () => void;
  onCorrect?: () => void;
}) {
  const [customer, setCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (booking.customerId) {
      fetch(`/api/customers/${booking.customerId}`)
        .then((r) => r.json())
        .then((d) => setCustomer(d.customer || null))
        .catch(() => {});
    }
  }, [booking.customerId]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-hairline rounded-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg">{booking.customerName}</h2>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full border"
            style={{
              borderColor: service?.color || "rgba(224,168,63,0.4)",
              color: service?.color || "#e0a83f",
            }}
          >
            {STATUS_LABEL[booking.status] || booking.status}
          </span>
        </div>
        <p className="text-cream/50 text-sm mb-4">
          {service?.name || booking.notes || "Afspraak"}
        </p>

        <div className="space-y-1.5 text-sm mb-5">
          <p className="text-cream/70">{formatDateTime(booking.start)}</p>
          {customer?.phone && (
            <p className="text-cream/50">
              <a href={`tel:${customer.phone}`} className="hover:text-gold">
                {customer.phone}
              </a>
            </p>
          )}
          {customer?.email && <p className="text-cream/50">{customer.email}</p>}
          {booking.notes && (
            <p className="text-cream/40 italic">&ldquo;{booking.notes}&rdquo;</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {booking.status === "pending" && (
            <>
              <button
                onClick={onConfirm}
                className="text-xs px-3 py-1.5 rounded-full bg-gold-gradient text-deep font-semibold"
              >
                Bevestigen
              </button>
              <button
                onClick={onCancel}
                className="text-xs px-3 py-1.5 rounded-full border border-hairline hover:border-red-700 hover:text-red-400 transition"
              >
                Afwijzen
              </button>
            </>
          )}
          {booking.status === "confirmed" && (
            <>
              <button
                onClick={onCheckout}
                className="text-xs px-3 py-1.5 rounded-full bg-gold-gradient text-deep font-semibold"
              >
                Afronden &amp; kassa
              </button>
              <button
                onClick={onNoShow}
                className="text-xs px-3 py-1.5 rounded-full border border-red-800/50 text-red-400 hover:bg-red-950/30 transition"
              >
                No show
              </button>
              <button
                onClick={onCancel}
                className="text-xs px-3 py-1.5 rounded-full border border-hairline hover:border-red-700 hover:text-red-400 transition"
              >
                Annuleren
              </button>
            </>
          )}
          {booking.status === "done" && (
            <>
              {!isDayClosed ? (
                <>
                  <button
                    onClick={onCheckout}
                    className="text-xs px-3 py-1.5 rounded-full border border-hairline hover:border-gold transition"
                  >
                    Bedrag/betaling aanpassen
                  </button>
                  {onQuickDeleteSale && (
                    <button
                      onClick={onQuickDeleteSale}
                      className="text-xs px-3 py-1.5 rounded-full border border-hairline hover:border-red-700 hover:text-red-400 transition"
                      title="Verkeerd geboekt? Verwijderen kan nog vrij zolang de dag niet is afgesloten."
                    >
                      Verwijderen
                    </button>
                  )}
                </>
              ) : (
                onCorrect && (
                  <button
                    onClick={onCorrect}
                    className="text-xs px-3 py-1.5 rounded-full border border-hairline text-cream/40 hover:border-red-700 hover:text-red-400 transition"
                  >
                    Kassaverrichting corrigeren
                  </button>
                )
              )}
            </>
          )}
          {booking.status === "no_show" && (
            <button
              onClick={onRevertNoShow}
              className="text-xs px-3 py-1.5 rounded-full border border-emerald-700/50 text-emerald-300 hover:bg-emerald-950/30 transition"
            >
              Annuleren No Show
            </button>
          )}
          {(booking.status === "cancelled" ||
            booking.status === "blocked" ||
            booking.status === "no_show") && (
            <button
              onClick={onDelete}
              className="text-xs px-3 py-1.5 rounded-full border border-hairline hover:border-red-700 hover:text-red-400 transition"
            >
              Verwijderen
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-full border border-hairline hover:border-gold transition text-sm"
        >
          Sluiten
        </button>
      </div>
    </div>
  );
}
