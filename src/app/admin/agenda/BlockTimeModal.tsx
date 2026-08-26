"use client";

import { useEffect, useRef, useState } from "react";
import { Customer, Service } from "@/lib/types";
import { formatBelgianPhone } from "@/lib/phone";

export default function BlockTimeModal({
  date,
  initialTime,
  initialMode,
  onClose,
  onDone,
}: {
  date: string;
  initialTime?: string;
  initialMode?: "block" | "appointment";
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"block" | "appointment">(initialMode || "block");
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [start, setStart] = useState(initialTime || "09:00");
  const [duration, setDuration] = useState(30);

  // Klant koppelen: zoeken in bestaande klanten (op naam) of een nieuwe
  // aanmaken. customerQuery blijft ook bruikbaar als vrije-tekst-naam
  // (zonder koppeling), voor snelle/eenmalige gevallen.
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const customerFieldRef = useRef<HTMLDivElement>(null);

  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data: Service[]) => setServices(data.filter((s) => s.active)));
    fetch("/api/customers")
      .then((r) => r.json())
      .then((data: Customer[]) => setCustomers(data));
  }, []);

  useEffect(() => {
    if (mode === "appointment" && serviceId) {
      const s = services.find((s) => s.id === serviceId);
      if (s) setDuration(s.durationMinutes);
    }
  }, [serviceId, mode, services]);

  // Dropdown sluiten bij een klik buiten het zoekveld.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (customerFieldRef.current && !customerFieldRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const customerMatches =
    !selectedCustomer && customerQuery.trim().length > 0
      ? customers
          .filter((c) => c.name.toLowerCase().includes(customerQuery.trim().toLowerCase()))
          .slice(0, 6)
      : [];

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setCustomerQuery(c.name);
    setCustomerDropdownOpen(false);
  }

  function clearSelectedCustomer() {
    setSelectedCustomer(null);
    setCustomerQuery("");
  }

  async function handleSubmit() {
    setError(null);
    const startIso = new Date(`${date}T${start}:00`).toISOString();
    const endIso = new Date(
      new Date(startIso).getTime() + duration * 60000
    ).toISOString();

    if (mode === "appointment" && !serviceId) {
      setError("Kies een dienst.");
      return;
    }
    if (mode === "appointment" && showNewCustomerForm && (!newCustomerName.trim() || !newCustomerPhone.trim())) {
      setError("Vul naam en GSM-nummer van de nieuwe klant in.");
      return;
    }
    if (mode === "appointment" && !showNewCustomerForm && !selectedCustomer && !customerQuery.trim()) {
      setError("Kies een klant, maak een nieuwe aan, of vul minstens een naam in.");
      return;
    }

    setSubmitting(true);

    // Bij "nieuwe klant": eerst het klantprofiel aanmaken (of laten
    // samenvoegen op basis van GSM-nummer als die al bestaat), dan pas de
    // afspraak koppelen aan dat profiel.
    let customerId: string | null = selectedCustomer?.id || null;
    let customerName = selectedCustomer?.name || customerQuery.trim();

    if (mode === "appointment" && showNewCustomerForm) {
      const phoneResult = formatBelgianPhone(newCustomerPhone);
      if (!phoneResult.ok) {
        setSubmitting(false);
        setError(phoneResult.error);
        return;
      }
      const custRes = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCustomerName.trim(), phone: phoneResult.formatted }),
      });
      if (!custRes.ok) {
        setSubmitting(false);
        setError("Aanmaken van de nieuwe klant is mislukt.");
        return;
      }
      const custData = await custRes.json();
      customerId = custData.customer.id;
      customerName = custData.customer.name;
    }

    const res = await fetch("/api/bookings/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: mode === "appointment" ? serviceId : null,
        start: startIso,
        end: endIso,
        status: mode === "appointment" ? "confirmed" : "blocked",
        customerId: mode === "appointment" ? customerId : null,
        customerName: mode === "appointment" ? customerName : notes || "Geblokkeerd",
        notes: mode === "appointment" ? notes : "",
      }),
    });
    setSubmitting(false);
    if (res.ok) onDone();
    else setError("Er ging iets mis.");
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-hairline rounded-2xl w-full max-w-md p-6">
        <h2 className="font-display text-xl mb-5">
          {date} toevoegen
        </h2>

        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            onClick={() => setMode("block")}
            className={`py-2 rounded-lg border text-sm transition ${
              mode === "block"
                ? "bg-gold-gradient text-deep font-semibold border-transparent"
                : "border-hairline hover:border-gold"
            }`}
          >
            Tijd blokkeren
          </button>
          <button
            onClick={() => setMode("appointment")}
            className={`py-2 rounded-lg border text-sm transition ${
              mode === "appointment"
                ? "bg-gold-gradient text-deep font-semibold border-transparent"
                : "border-hairline hover:border-gold"
            }`}
          >
            Afspraak toevoegen
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream/50 mb-1.5">
                Starttijd
              </label>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:border-gold [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1.5">
                Duur (min)
              </label>
              <input
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:border-gold"
              />
            </div>
          </div>

          {mode === "appointment" && (
            <>
              <div>
                <label className="block text-xs text-cream/50 mb-1.5">
                  Dienst
                </label>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:border-gold"
                >
                  <option value="">Kies een dienst...</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (&euro;{s.price})
                    </option>
                  ))}
                </select>
              </div>
              <div ref={customerFieldRef} className="relative">
                <label className="block text-xs text-cream/50 mb-1.5">
                  Klant
                </label>

                {showNewCustomerForm ? (
                  <div className="space-y-2 border border-hairline rounded-lg p-3 bg-deep/40">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gold/80 uppercase tracking-wide">
                        Nieuwe klant
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewCustomerForm(false);
                          setNewCustomerName("");
                          setNewCustomerPhone("");
                        }}
                        className="text-[11px] text-cream/40 hover:text-gold"
                      >
                        annuleren
                      </button>
                    </div>
                    <input
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="Voor- en achternaam"
                      className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
                    />
                    <input
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="GSM-nummer (bv. 499 12 34 56)"
                      className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
                    />
                  </div>
                ) : selectedCustomer ? (
                  <div className="flex items-center justify-between bg-deep border border-hairline rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{selectedCustomer.name}</p>
                      <p className="text-[11px] text-cream/40 truncate">{selectedCustomer.phone}</p>
                    </div>
                    <button
                      type="button"
                      onClick={clearSelectedCustomer}
                      className="text-[11px] text-cream/40 hover:text-gold shrink-0 ml-2"
                    >
                      wijzigen
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      onFocus={() => setCustomerDropdownOpen(true)}
                      placeholder="Typ een voornaam om te zoeken..."
                      className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:border-gold"
                    />
                    {customerDropdownOpen && customerMatches.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-panel border border-hairline rounded-lg shadow-lg overflow-hidden">
                        {customerMatches.map((c) => (
                          <button
                            type="button"
                            key={c.id}
                            onClick={() => selectCustomer(c)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gold/10 transition flex items-center justify-between gap-2"
                          >
                            <span className="truncate">{c.name}</span>
                            <span className="text-[11px] text-cream/40 shrink-0">{c.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewCustomerForm(true);
                        setCustomerDropdownOpen(false);
                        setNewCustomerName(customerQuery.trim());
                      }}
                      className="text-[11px] text-gold/80 hover:text-gold mt-1.5"
                    >
                      + Nieuwe klant toevoegen
                    </button>
                  </>
                )}
              </div>
              <div>
                <label className="block text-xs text-cream/50 mb-1.5">
                  Opmerking
                </label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:border-gold"
                />
              </div>
            </>
          )}

          {mode === "block" && (
            <div>
              <label className="block text-xs text-cream/50 mb-1.5">
                Reden (optioneel)
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="bv. verlof, pauze, privé"
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:border-gold"
              />
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

        <div className="flex gap-2 mt-6">
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
            {submitting ? "Bezig..." : "Toevoegen"}
          </button>
        </div>
      </div>
    </div>
  );
}
