"use client";

import { useEffect, useState } from "react";
import { Booking, GiftVoucher, Product, Sale, SaleItem, Service } from "@/lib/types";

export default function CheckoutModal({
  booking,
  service,
  existingSale,
  onClose,
  onDone,
}: {
  booking: Booking;
  service: Service | null;
  existingSale?: Sale | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const isEditing = !!existingSale;

  const [products, setProducts] = useState<Product[]>([]);
  const [vouchers, setVouchers] = useState<GiftVoucher[]>([]);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [items, setItems] = useState<SaleItem[]>(
    existingSale
      ? existingSale.items
      : service
      ? [{ type: "service", refId: service.id, name: service.name, price: service.price, qty: 1 }]
      : []
  );
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qr">(
    existingSale?.paymentMethod === "qr" ? "qr" : "cash"
  );
  const [totalOverride, setTotalOverride] = useState(
    existingSale ? String(existingSale.total) : ""
  );
  const [showVoucher, setShowVoucher] = useState(!!existingSale?.giftVoucherId);
  const [selectedVoucherId, setSelectedVoucherId] = useState(
    existingSale?.giftVoucherId || ""
  );
  const [voucherAmountInput, setVoucherAmountInput] = useState(
    existingSale?.giftVoucherAmountUsed ? String(existingSale.giftVoucherAmountUsed) : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentDiscount, setStudentDiscount] = useState(
    existingSale?.studentDiscount || false
  );
  const [studentDiscountPercent, setStudentDiscountPercent] = useState(10);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then(setProducts);
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        setQrImage(s.qrImageDataUrl || null);
        if (s.studentDiscountPercent !== undefined) {
          setStudentDiscountPercent(s.studentDiscountPercent);
        }
      });
    fetch("/api/gift-vouchers")
      .then((r) => r.json())
      .then((data: GiftVoucher[]) => {
        // Bij bewerken van een bestaande verkoop: ook de reeds gekoppelde
        // bon tonen, ook al staat die intussen misschien op 0 resterend.
        const relevant = existingSale?.giftVoucherId
          ? data.filter(
              (v) => v.remainingAmount > 0 || v.id === existingSale.giftVoucherId
            )
          : data.filter((v) => v.remainingAmount > 0);
        setVouchers(relevant);
      });
  }, [existingSale]);

  function addProduct(p: Product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.type === "product" && i.refId === p.id);
      if (existing) {
        return prev.map((i) =>
          i === existing ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [
        ...prev,
        { type: "product", refId: p.id, name: p.name, price: p.salePrice ?? 0, qty: 1 },
      ];
    });
  }

  const filteredProducts = productSearch.trim()
    ? products.filter((p) =>
        p.name.toLowerCase().includes(productSearch.trim().toLowerCase())
      )
    : products;

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItemPrice(index: number, price: number) {
    setItems((prev) => prev.map((i, idx) => (idx === index ? { ...i, price } : i)));
  }

  function updateItemQty(index: number, qty: number) {
    setItems((prev) => prev.map((i, idx) => (idx === index ? { ...i, qty } : i)));
  }

  const itemsTotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  // Voorgesteld bedrag: som van de items, met studentenkorting eraf indien
  // aangevinkt. Een handmatig ingevuld totaal (totalOverride) blijft altijd
  // het laatste woord — de korting past enkel het voorstel aan.
  const suggestedTotal = studentDiscount
    ? Math.round(itemsTotal * (1 - studentDiscountPercent / 100) * 100) / 100
    : itemsTotal;
  const total = totalOverride !== "" ? Number(totalOverride) || 0 : suggestedTotal;
  const isOverridden = totalOverride !== "" && Number(totalOverride) !== suggestedTotal;
  const selectedVoucher = vouchers.find((v) => v.id === selectedVoucherId) || null;
  const voucherCapForEditing =
    isEditing && selectedVoucher && selectedVoucher.id === existingSale?.giftVoucherId
      ? selectedVoucher.remainingAmount + (existingSale?.giftVoucherAmountUsed || 0)
      : selectedVoucher?.remainingAmount || 0;
  const maxVoucherUsable = selectedVoucher ? Math.min(voucherCapForEditing, total) : 0;
  const voucherAmount = selectedVoucher
    ? Math.min(Number(voucherAmountInput) || 0, maxVoucherUsable)
    : 0;
  const remainingAfterVoucher = Math.max(0, Math.round((total - voucherAmount) * 100) / 100);

  function selectVoucher(v: GiftVoucher) {
    setSelectedVoucherId(v.id);
    setVoucherAmountInput(String(Math.min(v.remainingAmount, total)));
  }

  function clearVoucher() {
    setSelectedVoucherId("");
    setVoucherAmountInput("");
  }

  async function handleCheckout() {
    setSubmitting(true);
    setError(null);
    const finalPaymentMethod = remainingAfterVoucher === 0 && voucherAmount > 0 ? "voucher" : paymentMethod;

    const body = {
      bookingId: booking.id,
      customerId: booking.customerId,
      items,
      paymentMethod: finalPaymentMethod,
      giftVoucherId: selectedVoucher ? selectedVoucher.id : undefined,
      giftVoucherAmountUsed: voucherAmount > 0 ? voucherAmount : undefined,
      totalOverride: isOverridden || isEditing ? total : undefined,
      studentDiscount,
    };

    const res = isEditing
      ? await fetch(`/api/sales/${existingSale!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

    setSubmitting(false);
    if (res.ok) {
      onDone();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Er ging iets mis. Probeer opnieuw.");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-hairline rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-xl mb-1">
          {isEditing ? "Kassa aanpassen" : "Kassa"}
        </h2>
        <p className="text-cream/40 text-sm mb-6">{booking.customerName}</p>
        {isEditing && (
          <p className="text-xs text-amber-300 bg-amber-950/20 border border-amber-800/40 rounded-lg px-3 py-2 mb-4">
            Deze afspraak was al afgerond. Pas hier aan als de klant zich
            achteraf bedacht heeft (bv. andere prijs).
          </p>
        )}

        <div className="space-y-2 mb-4">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate">{item.name}</span>
              <input
                type="number"
                min={1}
                value={item.qty}
                onChange={(e) => updateItemQty(i, Number(e.target.value))}
                className="w-14 bg-deep border border-hairline rounded px-2 py-1 text-center"
              />
              <span className="text-cream/40">&times; &euro;</span>
              <input
                type="number"
                min={0}
                step="0.5"
                value={item.price}
                onChange={(e) => updateItemPrice(i, Number(e.target.value))}
                className="w-16 bg-deep border border-hairline rounded px-2 py-1 text-center"
              />
              <button
                onClick={() => removeItem(i)}
                className="text-cream/30 hover:text-red-400 px-1"
                aria-label="Verwijderen"
              >
                &times;
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-xs text-cream/40">Geen items toegevoegd.</p>
          )}
        </div>

        <details className="mb-4">
          <summary className="text-xs text-gold/80 hover:text-gold cursor-pointer select-none">
            + Product uit voorraad toevoegen
          </summary>
          <input
            type="text"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="Zoek product..."
            className="mt-2 w-full bg-deep border border-hairline rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-gold"
          />
          <div className="mt-2 grid gap-1.5 max-h-36 overflow-y-auto">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                className="text-left text-xs px-2.5 py-1.5 rounded-lg border border-hairline hover:border-gold transition flex justify-between"
              >
                <span>{p.name}</span>
                <span className="text-cream/40">{p.stock} {p.unit}</span>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <p className="text-xs text-cream/30 px-1 py-1">Geen producten gevonden.</p>
            )}
          </div>
        </details>

        {/* CADEAUBON */}
        <div className="mb-4">
          {!showVoucher && !selectedVoucher ? (
            <button
              onClick={() => setShowVoucher(true)}
              className="text-xs text-gold/80 hover:text-gold underline underline-offset-2"
            >
              Betalen (deels) met een cadeaubon?
            </button>
          ) : (
            <div className="p-3 border border-hairline rounded-lg bg-panel2/40">
              {!selectedVoucher ? (
                <>
                  <p className="text-xs text-cream/50 mb-2">Kies een cadeaubon:</p>
                  {vouchers.length === 0 ? (
                    <p className="text-xs text-cream/40 mb-2">
                      Geen openstaande cadeaubonnen gevonden. Registreer er een bij
                      Cadeaubonnen (menu links).
                    </p>
                  ) : (
                    <div className="grid gap-1.5 max-h-32 overflow-y-auto mb-2">
                      {vouchers.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => selectVoucher(v)}
                          className="text-left text-xs px-2.5 py-1.5 rounded-lg border border-hairline hover:border-gold transition flex justify-between"
                        >
                          <span>{v.code}{v.customerName ? ` — ${v.customerName}` : ""}</span>
                          <span className="text-gold-light font-display">
                            &euro;{v.remainingAmount.toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setShowVoucher(false)}
                    className="text-[11px] text-cream/40 hover:text-gold"
                  >
                    Annuleren
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm">
                      Cadeaubon <span className="text-gold-light">{selectedVoucher.code}</span>
                    </p>
                    <button
                      onClick={clearVoucher}
                      className="text-[11px] text-cream/40 hover:text-red-400"
                    >
                      verwijderen
                    </button>
                  </div>
                  <p className="text-xs text-cream/40 mb-2">
                    Resterend saldo: &euro;{voucherCapForEditing.toFixed(2)}
                  </p>
                  <label className="block text-xs text-cream/50 mb-1">
                    Te gebruiken bedrag
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={maxVoucherUsable}
                    step="0.01"
                    value={voucherAmountInput}
                    onChange={(e) => setVoucherAmountInput(e.target.value)}
                    className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
                  />
                </>
              )}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={studentDiscount}
            onChange={(e) => setStudentDiscount(e.target.checked)}
            className="accent-[#e0a83f]"
          />
          <span className="text-cream/70">
            Studentenkorting toegepast (-{studentDiscountPercent}%)
          </span>
        </label>

        <div className="space-y-1 mb-5 pt-3 border-t border-hairline">
          <div className="flex justify-between items-center gap-3">
            <span className="text-cream/60 text-sm shrink-0">Totaal</span>
            <div className="flex items-center gap-2">
              <span className="text-gold-light">&euro;</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={totalOverride !== "" ? totalOverride : suggestedTotal.toFixed(2)}
                onChange={(e) => setTotalOverride(e.target.value)}
                className="w-24 bg-deep border border-hairline rounded-lg px-2 py-1.5 text-right font-display text-xl text-gold-light focus:outline-none focus:border-gold"
              />
            </div>
          </div>
          {isOverridden && (
            <div className="flex justify-between text-[11px] text-cream/40">
              <span>Voorgesteld bedrag was &euro;{suggestedTotal.toFixed(2)}</span>
              <button
                onClick={() => setTotalOverride("")}
                className="text-gold/70 hover:text-gold underline underline-offset-2"
              >
                terugzetten
              </button>
            </div>
          )}
          {voucherAmount > 0 && (
            <>
              <div className="flex justify-between text-xs text-cream/50">
                <span>Cadeaubon {selectedVoucher?.code}</span>
                <span>&minus;&euro;{voucherAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm pt-1">
                <span className="text-cream/70">Nog te betalen</span>
                <span className="font-display text-gold-light">
                  &euro;{remainingAfterVoucher.toFixed(2)}
                </span>
              </div>
            </>
          )}
        </div>

        {remainingAfterVoucher > 0 && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-6">
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`py-2.5 rounded-lg border text-sm transition ${
                  paymentMethod === "cash"
                    ? "bg-gold-gradient text-deep font-semibold border-transparent"
                    : "border-hairline hover:border-gold"
                }`}
              >
                Cash
              </button>
              <button
                onClick={() => setPaymentMethod("qr")}
                className={`py-2.5 rounded-lg border text-sm transition ${
                  paymentMethod === "qr"
                    ? "bg-gold-gradient text-deep font-semibold border-transparent"
                    : "border-hairline hover:border-gold"
                }`}
              >
                QR-code
              </button>
            </div>

            {paymentMethod === "qr" && (
              <div className="mb-6 text-center bg-deep border border-hairline rounded-xl p-6">
                {qrImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrImage}
                    alt="Scan om te betalen"
                    className="w-40 h-40 mx-auto mb-3 object-contain rounded-lg"
                  />
                ) : (
                  <>
                    <div className="w-32 h-32 mx-auto mb-3 bg-cream/5 border border-dashed border-hairline rounded-lg flex items-center justify-center text-cream/30 text-xs">
                      Payconiq QR
                    </div>
                    <p className="text-xs text-cream/40">
                      Nog geen QR-afbeelding ingesteld &mdash; upload er een via
                      Instellingen.
                    </p>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {remainingAfterVoucher === 0 && voucherAmount > 0 && (
          <div className="mb-6 text-center bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
            <p className="text-sm text-emerald-300">
              Volledig betaald met cadeaubon &euro;{voucherAmount.toFixed(2)}
            </p>
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
            disabled={submitting || items.length === 0}
            onClick={handleCheckout}
            className="flex-1 py-2.5 rounded-full bg-gold-gradient text-deep font-semibold text-sm disabled:opacity-40 transition"
          >
            {submitting ? "Bezig..." : isEditing ? "Aanpassing opslaan" : "Afronden"}
          </button>
        </div>
      </div>
    </div>
  );
}
