"use client";

import { useEffect, useMemo, useState } from "react";
import { Service } from "@/lib/types";
import { combineAddress } from "@/lib/address";
import { formatBelgianPhone } from "@/lib/phone";

type Step = 1 | 2 | 3 | 4;

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("nl-BE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateLabel(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const STORAGE_KEY = "beijJelleKlantgegevens";

type SavedDetails = {
  firstName: string;
  lastName: string;
  phoneLocal: string;
  email: string;
  street: string;
  postalCode: string;
  city: string;
};

export default function BookingFlow() {
  const [step, setStep] = useState<Step>(1);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const [date, setDate] = useState(formatDate(new Date()));
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [customTimeMode, setCustomTimeMode] = useState(false);
  const [customTime, setCustomTime] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [email, setEmail] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);
  const [confirmed, setConfirmed] = useState<{
    start: string;
    pending: boolean;
  } | null>(null);

  // Vult automatisch de gegevens van een vorig bezoek in (lokaal op dit
  // toestel bewaard), zodat een terugkerende klant niet alles opnieuw
  // moet intypen.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: SavedDetails = JSON.parse(raw);
        setFirstName(saved.firstName || "");
        setLastName(saved.lastName || "");
        setPhoneLocal(saved.phoneLocal || "");
        setEmail(saved.email || "");
        setStreet(saved.street || "");
        setPostalCode(saved.postalCode || "");
        setCity(saved.city || "");
        if (saved.firstName || saved.lastName) setRestoredFromStorage(true);
      }
    } catch {
      // localStorage niet beschikbaar (bv. privé-browsen) — gewoon negeren
    }
  }, []);

  function clearSavedDetails() {
    setFirstName("");
    setLastName("");
    setPhoneLocal("");
    setEmail("");
    setStreet("");
    setPostalCode("");
    setCity("");
    setRestoredFromStorage(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // negeren
    }
  }

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data: Service[]) => setServices(data.filter((s) => s.active)));
  }, []);

  useEffect(() => {
    if (step !== 2 || !selectedService) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    fetch(`/api/availability?serviceId=${selectedService.id}&date=${date}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots || []))
      .finally(() => setLoadingSlots(false));
  }, [step, selectedService, date]);

  const grouped = useMemo(() => {
    const g: Record<string, Service[]> = {};
    for (const s of services) {
      g[s.category] = g[s.category] || [];
      g[s.category].push(s);
    }
    return g;
  }, [services]);

  function effectiveStart(): string | null {
    if (customTimeMode) {
      if (!customTime) return null;
      return new Date(`${date}T${customTime}:00`).toISOString();
    }
    return selectedSlot;
  }

  async function handleSubmit() {
    const start = effectiveStart();
    if (!selectedService || !start) return;

    const phoneResult = formatBelgianPhone(phoneLocal);
    if (!phoneResult.ok) {
      setError(phoneResult.error);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService.id,
          start,
          customer: {
            name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            phone: phoneResult.formatted,
            email,
            address: combineAddress({ street, postalCode, city }),
          },
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Er ging iets mis. Probeer opnieuw.");
        setSubmitting(false);
        return;
      }
      setConfirmed({ start, pending: !data.isWithinUsualSlots });
      setStep(4);
      try {
        const toSave: SavedDetails = {
          firstName,
          lastName,
          phoneLocal,
          email,
          street,
          postalCode,
          city,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch {
        // localStorage niet beschikbaar — geen probleem, gewoon niet onthouden
      }
    } catch {
      setError("Kon geen verbinding maken. Probeer het later opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }

  const steps: { n: Step; label: string }[] = [
    { n: 1, label: "Dienst" },
    { n: 2, label: "Moment" },
    { n: 3, label: "Gegevens" },
  ];

  return (
    <div>
      {step !== 4 && (
        <ol className="flex items-center gap-2 mb-9 text-xs">
          {steps.map((s, i) => (
            <li key={s.n} className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center font-display border ${
                  step === s.n
                    ? "bg-gold-gradient text-deep border-transparent"
                    : step > s.n
                    ? "border-gold text-gold"
                    : "border-hairline text-cream/40"
                }`}
              >
                {s.n}
              </span>
              <span className={step >= s.n ? "text-cream/80" : "text-cream/30"}>
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <span className="w-6 h-px bg-hairline mx-1" />
              )}
            </li>
          ))}
        </ol>
      )}

      {step === 1 && (
        <div className="space-y-8">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h3 className="font-display text-gold text-sm mb-3">{category}</h3>
              <div className="grid gap-2">
                {items.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedService(s);
                      setStep(2);
                    }}
                    className="flex justify-between items-center text-left px-4 py-3 rounded-xl border border-hairline hover:border-gold hover:bg-panel transition"
                  >
                    <span>
                      <span className="block">{s.name}</span>
                      <span className="block text-xs text-cream/40 mt-0.5">
                        &plusmn; {s.durationMinutes} min
                      </span>
                    </span>
                    <span className="font-display text-gold-light">
                      &euro;{s.price}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {services.length === 0 && (
            <p className="text-cream/40 text-sm">Diensten laden...</p>
          )}
          <a
            href="/"
            className="block w-full text-center text-base font-medium text-cream/70 hover:text-gold-light transition py-4 mt-4 border-t border-hairline"
          >
            &larr; Terug naar home
          </a>
        </div>
      )}

      {step === 2 && selectedService && (
        <div>
          <button
            onClick={() => setStep(1)}
            className="text-xs text-cream/40 hover:text-gold mb-5"
          >
            &larr; Andere dienst kiezen
          </button>
          <div className="mb-6 px-4 py-3 rounded-xl bg-panel border border-hairline flex justify-between">
            <span>{selectedService.name}</span>
            <span className="text-gold-light font-display">
              &euro;{selectedService.price}
            </span>
          </div>

          <label className="block text-xs text-cream/50 mb-2">Kies een dag</label>
          <input
            type="date"
            value={date}
            min={formatDate(new Date())}
            onChange={(e) => setDate(e.target.value)}
            className="w-full mb-6 bg-panel border border-hairline rounded-lg px-4 py-2.5 text-cream focus:outline-none focus:border-gold [color-scheme:dark]"
          />

          {!customTimeMode && (
            <>
              <label className="block text-xs text-cream/50 mb-2">
                Beschikbare tijdstippen &mdash; {formatDateLabel(date)}
              </label>
              {loadingSlots ? (
                <p className="text-cream/40 text-sm mb-6">
                  Beschikbaarheid ophalen...
                </p>
              ) : slots.length === 0 ? (
                <p className="text-cream/40 text-sm mb-6">
                  Geen vrije momenten op deze dag binnen de gebruikelijke uren.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-2 rounded-lg border text-sm transition ${
                        selectedSlot === slot
                          ? "bg-gold-gradient text-deep border-transparent font-semibold"
                          : "border-hairline hover:border-gold"
                      }`}
                    >
                      {formatTime(slot)}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  setCustomTimeMode(true);
                  setSelectedSlot(null);
                }}
                className="text-xs text-gold/80 hover:text-gold underline underline-offset-2 mb-8"
              >
                Past geen enkel tijdstip? Vraag een ander moment aan (vroeger
                of later)
              </button>
            </>
          )}

          {customTimeMode && (
            <div className="mb-8">
              <label className="block text-xs text-cream/50 mb-2">
                Gewenst tijdstip op {formatDateLabel(date)}
              </label>
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-full bg-panel border border-hairline rounded-lg px-4 py-2.5 mb-2 focus:outline-none focus:border-gold [color-scheme:dark]"
              />
              <p className="text-xs text-cream/40 mb-3">
                Dit tijdstip valt buiten de gebruikelijke uren. Jelle bekijkt
                je aanvraag en bevestigt persoonlijk of het past.
              </p>
              <button
                onClick={() => {
                  setCustomTimeMode(false);
                  setCustomTime("");
                }}
                className="text-xs text-cream/40 hover:text-gold underline underline-offset-2"
              >
                Toch liever een voorgesteld tijdstip kiezen
              </button>
            </div>
          )}

          <button
            disabled={!effectiveStart()}
            onClick={() => setStep(3)}
            className="w-full bg-gold-gradient disabled:opacity-30 disabled:cursor-not-allowed text-deep font-semibold py-3 rounded-full transition hover:brightness-110"
          >
            Verder
          </button>

          <button
            onClick={() => setStep(1)}
            className="w-full mt-3 text-xs text-cream/40 hover:text-gold transition py-2"
          >
            &larr; Terug naar dienst kiezen
          </button>
          <a
            href="/"
            className="block w-full text-center text-base font-medium text-cream/70 hover:text-gold-light transition py-3"
          >
            &larr; Terug naar home
          </a>
        </div>
      )}

      {step === 3 && selectedService && effectiveStart() && (
        <div>
          <button
            onClick={() => setStep(2)}
            className="text-xs text-cream/40 hover:text-gold mb-5"
          >
            &larr; Ander tijdstip kiezen
          </button>

          <div className="mb-6 px-4 py-3 rounded-xl bg-panel border border-hairline text-sm">
            <p className="text-cream/90">{selectedService.name}</p>
            <p className="text-cream/50">
              {formatDateLabel(date)} om {formatTime(effectiveStart()!)}
              {customTimeMode && (
                <span className="text-gold/70"> (aanvraag)</span>
              )}
            </p>
          </div>

          {restoredFromStorage && (
            <div className="mb-4 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-panel2/50 border border-hairline text-xs">
              <span className="text-cream/60">
                Ingevuld met je gegevens van vorige keer.
              </span>
              <button
                onClick={clearSavedDetails}
                className="text-gold/80 hover:text-gold underline underline-offset-2 shrink-0"
              >
                Niet jou? Wis gegevens
              </button>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-cream/50 mb-1.5">Voornaam *</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-panel border border-hairline rounded-lg px-4 py-2.5 focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-xs text-cream/50 mb-1.5">Achternaam *</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-panel border border-hairline rounded-lg px-4 py-2.5 focus:outline-none focus:border-gold"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1.5">
                GSM-nummer *
              </label>
              <div className="flex">
                <span className="flex items-center px-3 rounded-l-lg border border-r-0 border-hairline bg-panel2 text-cream/50 text-sm">
                  +32
                </span>
                <input
                  value={phoneLocal}
                  onChange={(e) => setPhoneLocal(e.target.value)}
                  placeholder="499 12 34 56"
                  className="w-full bg-panel border border-hairline rounded-r-lg px-4 py-2.5 focus:outline-none focus:border-gold"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1.5">
                E-mail (optioneel)
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voor herinneringen per mail"
                className="w-full bg-panel border border-hairline rounded-lg px-4 py-2.5 focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1.5">
                Adres (optioneel)
              </label>
              <input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Straat en huisnummer"
                className="w-full bg-panel border border-hairline rounded-lg px-4 py-2.5 mb-2 focus:outline-none focus:border-gold"
              />
              <div className="flex gap-2">
                <input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="Postcode"
                  className="w-24 bg-panel border border-hairline rounded-lg px-4 py-2.5 focus:outline-none focus:border-gold"
                />
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Gemeente"
                  className="flex-1 bg-panel border border-hairline rounded-lg px-4 py-2.5 focus:outline-none focus:border-gold"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1.5">
                Opmerking (optioneel)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-panel border border-hairline rounded-lg px-4 py-2.5 focus:outline-none focus:border-gold"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm mt-4">{error}</p>
          )}

          <button
            disabled={!firstName || !lastName || !phoneLocal || submitting}
            onClick={handleSubmit}
            className={`w-full mt-6 bg-gold-gradient text-deep font-semibold py-3 rounded-full transition-all duration-150 flex items-center justify-center gap-2 ${
              submitting
                ? "opacity-70 cursor-wait"
                : !firstName || !lastName || !phoneLocal
                ? "opacity-30 cursor-not-allowed"
                : "hover:brightness-110"
            }`}
          >
            {submitting && (
              <span className="inline-block w-4 h-4 border-2 border-deep/30 border-t-deep rounded-full animate-spin" />
            )}
            {submitting ? "Bezig met boeken..." : "Bevestig afspraak"}
          </button>

          <button
            onClick={() => setStep(2)}
            disabled={submitting}
            className="w-full mt-3 text-xs text-cream/40 hover:text-gold transition py-2 disabled:opacity-30"
          >
            &larr; Terug naar ander tijdstip
          </button>
          <a
            href="/"
            className="block w-full text-center text-base font-medium text-cream/70 hover:text-gold-light transition py-3"
          >
            &larr; Terug naar home
          </a>
        </div>
      )}

      {step === 4 && confirmed && selectedService && (
        <div className="text-center py-10">
          <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-gold-gradient flex items-center justify-center text-deep text-2xl">
            {confirmed.pending ? "?" : "✓"}
          </div>
          <h2 className="font-display text-xl mb-2">
            {confirmed.pending ? "Aanvraag verstuurd" : "Afspraak bevestigd"}
          </h2>
          <p className="text-cream/70 mb-1">{selectedService.name}</p>
          <p className="text-cream/50 text-sm mb-8">
            {formatDateLabel(confirmed.start.slice(0, 10))} om{" "}
            {formatTime(confirmed.start)}
          </p>
          {confirmed.pending ? (
            <p className="text-xs text-cream/40 mb-8">
              Dit tijdstip valt buiten de gebruikelijke uren. Jelle bekijkt je
              aanvraag persoonlijk en neemt contact met je op om te
              bevestigen.
            </p>
          ) : (
            <p className="text-xs text-cream/40 mb-8">
              Tot binnenkort bij Doeëg Mêin Haore! Kan je toch niet? Bel
              gerust naar het salon om te verzetten.
            </p>
          )}
          <a
            href="/"
            className="block w-full text-center border border-gold text-gold px-6 py-3 rounded-full hover:bg-panel transition font-semibold"
          >
            Terug naar home
          </a>
        </div>
      )}
    </div>
  );
}
