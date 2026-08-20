"use client";

import { useEffect, useState } from "react";
import { Booking, CancellationRecord, Customer, NoShowRecord, Sale, Service, Settings } from "@/lib/types";
import { combineAddress, parseAddress } from "@/lib/address";
import { formatBelgianPhone } from "@/lib/phone";
import MergeCustomerModal from "./MergeCustomerModal";
import { useSyncUnsavedChanges, useUnsavedChanges } from "../UnsavedChangesContext";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function brusselsYear(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
  }).format(new Date(iso));
}

function normalizeNameForCompare(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // accenten weghalen
}

function isLikelyDuplicateName(a: string, b: string): boolean {
  const na = normalizeNameForCompare(a);
  const nb = normalizeNameForCompare(b);
  if (!na || !nb || na === nb) return na === nb && na.length > 0;
  // eenvoudige Levenshtein-afstand, kleine tikfouten opvangen
  const dp: number[][] = Array.from({ length: na.length + 1 }, () =>
    new Array(nb.length + 1).fill(0)
  );
  for (let i = 0; i <= na.length; i++) dp[i][0] = i;
  for (let j = 0; j <= nb.length; j++) dp[0][j] = j;
  for (let i = 1; i <= na.length; i++) {
    for (let j = 1; j <= nb.length; j++) {
      dp[i][j] =
        na[i - 1] === nb[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  const distance = dp[na.length][nb.length];
  return distance > 0 && distance <= 2 && Math.max(na.length, nb.length) > 4;
}

function extractLocalPhone(phone: string): string {
  return phone.trim().replace(/^\+?32\s*/, "").trim();
}

export default function KlantenPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [detail, setDetail] = useState<{
    bookings: Booking[];
    sales: Sale[];
    noShowRecords: NoShowRecord[];
  } | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [noShowRecords, setNoShowRecords] = useState<NoShowRecord[]>([]);
  const [cancellationRecords, setCancellationRecords] = useState<CancellationRecord[]>([]);
  const [defaults, setDefaults] = useState<Pick<Settings, "reminderLongHours" | "reminderShortHours"> | null>(null);
  const [longOverride, setLongOverride] = useState("");
  const [shortOverride, setShortOverride] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [phoneLocalDraft, setPhoneLocalDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [streetDraft, setStreetDraft] = useState("");
  const [postalCodeDraft, setPostalCodeDraft] = useState("");
  const [cityDraft, setCityDraft] = useState("");
  const [contactSaved, setContactSaved] = useState(false);
  const [showNoShowDates, setShowNoShowDates] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [reminderSaved, setReminderSaved] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [savedContact, setSavedContact] = useState({
    name: "", phoneLocal: "", email: "", street: "", postalCode: "", city: "",
  });
  const [savedLongOverride, setSavedLongOverride] = useState("");
  const [savedShortOverride, setSavedShortOverride] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPhoneLocal, setNewPhoneLocal] = useState("");
  const [newStreet, setNewStreet] = useState("");
  const [newPostalCode, setNewPostalCode] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newCustomerMsg, setNewCustomerMsg] = useState<string | null>(null);
  const [newCustomerMsgIsError, setNewCustomerMsgIsError] = useState(false);

  function loadCustomers() {
    fetch("/api/customers")
      .then((r) => r.json())
      .then(setCustomers);
  }

  useEffect(() => {
    loadCustomers();
    fetch("/api/services").then((r) => r.json()).then(setServices);
    fetch("/api/bookings").then((r) => r.json()).then(setAllBookings);
    fetch("/api/no-show-records").then((r) => r.json()).then(setNoShowRecords);
    fetch("/api/cancellation-records").then((r) => r.json()).then(setCancellationRecords);
    fetch("/api/settings").then((r) => r.json()).then(setDefaults);
  }, []);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    const initialLong = selected.reminderLongHoursOverride?.toString() || "";
    const initialShort = selected.reminderShortHoursOverride?.toString() || "";
    const initialName = selected.name || "";
    const initialPhoneLocal = extractLocalPhone(selected.phone || "");
    const initialEmail = selected.email || "";
    const parsed = parseAddress(selected.address);
    setLongOverride(initialLong);
    setShortOverride(initialShort);
    setNameDraft(initialName);
    setPhoneLocalDraft(initialPhoneLocal);
    setEmailDraft(initialEmail);
    setStreetDraft(parsed.street);
    setPostalCodeDraft(parsed.postalCode);
    setCityDraft(parsed.city);
    setSavedContact({
      name: initialName,
      phoneLocal: initialPhoneLocal,
      email: initialEmail,
      street: parsed.street,
      postalCode: parsed.postalCode,
      city: parsed.city,
    });
    setSavedLongOverride(initialLong);
    setSavedShortOverride(initialShort);
    setContactError(null);
    setReminderError(null);
    setShowNoShowDates(false);
    fetch(`/api/customers/${selected.id}`)
      .then((r) => r.json())
      .then((data) => setDetail({ bookings: data.bookings, sales: data.sales, noShowRecords: data.noShowRecords || [] }));
  }, [selected]);

  const contactDirty =
    !!selected &&
    (nameDraft !== savedContact.name ||
      phoneLocalDraft !== savedContact.phoneLocal ||
      emailDraft !== savedContact.email ||
      streetDraft !== savedContact.street ||
      postalCodeDraft !== savedContact.postalCode ||
      cityDraft !== savedContact.city);

  const reminderOverrideDirty =
    !!selected && (longOverride !== savedLongOverride || shortOverride !== savedShortOverride);

  const newCustomerDraftDirty =
    showNew &&
    [newFirstName, newLastName, newPhoneLocal, newStreet, newPostalCode, newCity].some(
      (v) => v.trim().length > 0
    );

  useSyncUnsavedChanges(contactDirty || reminderOverrideDirty || newCustomerDraftDirty);

  const { confirmDiscard } = useUnsavedChanges();

  function trySelectCustomer(c: Customer | null) {
    if ((contactDirty || reminderOverrideDirty) && !confirmDiscard()) return;
    setSelected(c);
  }

  async function saveReminderOverride() {
    if (!selected) return;
    setReminderError(null);
    const res = await fetch(`/api/customers/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reminderLongHoursOverride: longOverride ? Number(longOverride) : undefined,
        reminderShortHoursOverride: shortOverride ? Number(shortOverride) : undefined,
      }),
    });
    if (!res.ok) {
      setReminderError("Opslaan is mislukt. Probeer opnieuw.");
      return;
    }
    setSavedLongOverride(longOverride);
    setSavedShortOverride(shortOverride);
    setReminderSaved(true);
    setTimeout(() => setReminderSaved(false), 2000);
    loadCustomers();
  }

  async function saveContactDetails() {
    if (!selected) return;
    if (!nameDraft.trim() || !phoneLocalDraft.trim()) {
      setContactError("Naam en GSM-nummer zijn verplicht.");
      return;
    }
    const phoneResult = formatBelgianPhone(phoneLocalDraft);
    if (!phoneResult.ok) {
      setContactError(phoneResult.error);
      return;
    }
    setContactError(null);
    const res = await fetch(`/api/customers/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nameDraft.trim(),
        phone: phoneResult.formatted,
        email: emailDraft,
        address: combineAddress({
          street: streetDraft,
          postalCode: postalCodeDraft,
          city: cityDraft,
        }),
      }),
    });
    if (!res.ok) {
      setContactError("Er ging iets mis bij het opslaan.");
      return;
    }
    const updated = await res.json();
    setSelected(updated);
    setContactSaved(true);
    setTimeout(() => setContactSaved(false), 2000);
    loadCustomers();
  }

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  async function createCustomer() {
    if (!newFirstName || !newLastName || !newPhoneLocal) return;
    const phoneResult = formatBelgianPhone(newPhoneLocal);
    if (!phoneResult.ok) {
      setNewCustomerMsgIsError(true);
      setNewCustomerMsg(phoneResult.error);
      setTimeout(() => setNewCustomerMsg(null), 4000);
      return;
    }
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${newFirstName.trim()} ${newLastName.trim()}`.trim(),
        phone: phoneResult.formatted,
        address: combineAddress({
          street: newStreet,
          postalCode: newPostalCode,
          city: newCity,
        }),
      }),
    });
    if (!res.ok) {
      setNewCustomerMsgIsError(true);
      setNewCustomerMsg("Aanmaken is mislukt. Je gegevens staan nog klaar — probeer opnieuw.");
      setTimeout(() => setNewCustomerMsg(null), 4000);
      return;
    }
    const data = await res.json();
    setNewFirstName("");
    setNewLastName("");
    setNewPhoneLocal("");
    setNewStreet("");
    setNewPostalCode("");
    setNewCity("");
    setShowNew(false);
    setNewCustomerMsgIsError(false);
    setNewCustomerMsg(
      data.existed
        ? `Deze klant (${data.customer.phone}) bestond al — gegevens bijgewerkt in plaats van dubbel aangemaakt.`
        : "Nieuwe klant aangemaakt."
    );
    setTimeout(() => setNewCustomerMsg(null), 4000);
    loadCustomers();
  }

  const serviceName = (id: string | null) =>
    services.find((s) => s.id === id)?.name || "—";

  const noShowCount = (customerId: string) =>
    noShowRecords.filter((r) => r.customerId === customerId).length;

  const cancelCount = (customerId: string) =>
    cancellationRecords.filter((r) => r.customerId === customerId).length;

  const possibleDuplicateOf = (c: Customer) =>
    customers.find((other) => other.id !== c.id && isLikelyDuplicateName(other.name, c.name));

  return (
    <div className="p-6 sm:p-10 max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl">Klanten</h1>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="text-xs border border-hairline hover:border-gold rounded-full px-4 py-2 transition"
        >
          + Nieuwe klant
        </button>
      </div>
      <p className="text-cream/40 text-sm mb-2">
        {customers.length} klant{customers.length === 1 ? "" : "en"}
      </p>
      {newCustomerMsg && (
        <p
          className={`text-xs px-3 py-1.5 rounded-full inline-block mb-6 border ${
            newCustomerMsgIsError
              ? "text-red-400 bg-red-950/30 border-red-800/60"
              : "text-gold bg-panel border-hairline"
          }`}
        >
          {newCustomerMsgIsError ? "⚠ " : "✓ "}
          {newCustomerMsg}
        </p>
      )}

      {showNew && (
        <div className="mb-6 p-4 border border-hairline rounded-xl bg-panel/40 flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-cream/50 mb-1">Voornaam</label>
            <input
              value={newFirstName}
              onChange={(e) => setNewFirstName(e.target.value)}
              className="bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Achternaam</label>
            <input
              value={newLastName}
              onChange={(e) => setNewLastName(e.target.value)}
              className="bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">GSM</label>
            <div className="flex">
              <span className="flex items-center px-2.5 rounded-l-lg border border-r-0 border-hairline bg-panel2 text-cream/50 text-sm">
                +32
              </span>
              <input
                value={newPhoneLocal}
                onChange={(e) => setNewPhoneLocal(e.target.value)}
                placeholder="499 12 34 56"
                className="bg-deep border border-hairline rounded-r-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Straat en nr (optioneel)</label>
            <input
              value={newStreet}
              onChange={(e) => setNewStreet(e.target.value)}
              placeholder="Kerkstraat 12"
              className="bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Postcode</label>
            <input
              value={newPostalCode}
              onChange={(e) => setNewPostalCode(e.target.value)}
              placeholder="3650"
              className="w-20 bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Gemeente</label>
            <input
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              placeholder="Stokkem"
              className="bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <button
            onClick={createCustomer}
            className="text-xs px-4 py-2 rounded-full bg-gold-gradient text-deep font-semibold"
          >
            Opslaan
          </button>
        </div>
      )}
      {newCustomerDraftDirty && (
        <p className="text-[11px] text-amber-300/90 -mt-4 mb-6">
          ⚠ Niet-opgeslagen nieuwe klant — gaat verloren als je wegnavigeert zonder op &ldquo;Opslaan&rdquo; te klikken.
        </p>
      )}

      <input
        placeholder="Zoek op naam of gsm..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-panel border border-hairline rounded-lg px-4 py-2.5 mb-6 focus:outline-none focus:border-gold"
      />

      <div className="grid sm:grid-cols-2 gap-6">
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => trySelectCustomer(c)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                  selected?.id === c.id
                    ? "border-gold bg-panel"
                    : "border-hairline hover:border-gold/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm">{c.name}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    {possibleDuplicateOf(c) && (
                      <span
                        title={`Lijkt op: ${possibleDuplicateOf(c)?.name} (${possibleDuplicateOf(c)?.phone})`}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/40 text-amber-300 border border-amber-700/50 cursor-help"
                      >
                        mogelijk dubbel
                      </span>
                    )}
                    {noShowCount(c.id) > 0 && (
                      <span
                        title={noShowRecords
                          .filter((r) => r.customerId === c.id)
                          .map((r) => formatDateTime(r.date))
                          .join(", ")}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-950/50 text-red-300 border border-red-800/50 cursor-help"
                      >
                        {noShowCount(c.id)}x no show
                      </span>
                    )}
                    {cancelCount(c.id) > 0 && (
                      <span
                        title={cancellationRecords
                          .filter((r) => r.customerId === c.id)
                          .map((r) => `${formatDateTime(r.date)}${r.reason ? " — " + r.reason : ""}`)
                          .join(", ")}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-panel2 text-cream/50 border border-hairline cursor-help"
                      >
                        {cancelCount(c.id)}x geannuleerd
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-cream/40">{c.phone}</p>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <p className="text-cream/40 text-sm">Geen klanten gevonden.</p>
          )}
        </ul>

        {selected && (
          <div className="border border-hairline rounded-xl p-5 bg-panel/40 h-fit">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs text-gold/80 uppercase tracking-wide">
                Contactgegevens
              </h3>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setShowMerge(true)}
                  className="text-[10px] px-2 py-1 rounded-full border border-hairline hover:border-gold text-cream/50 hover:text-gold transition"
                >
                  Dubbele klant samenvoegen
                </button>
                <button
                  onClick={async () => {
                    if (
                      !confirm(
                        `${selected.name} definitief verwijderen? Afspraken/verkopen in de historiek blijven bestaan, maar niet langer gekoppeld aan een klantprofiel.`
                      )
                    )
                      return;
                    await fetch(`/api/customers/${selected.id}`, { method: "DELETE" });
                    setSelected(null);
                    setDetail(null);
                    loadCustomers();
                  }}
                  className="text-[10px] px-2 py-1 rounded-full border border-hairline hover:border-red-700 text-cream/50 hover:text-red-400 transition"
                >
                  Verwijderen
                </button>
              </div>
            </div>
            <div className="space-y-2.5 mb-2">
              <div>
                <label className="block text-[11px] text-cream/40 mb-1">Naam</label>
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="w-full bg-deep border border-hairline rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-[11px] text-cream/40 mb-1">GSM</label>
                <div className="flex">
                  <span className="flex items-center px-2.5 rounded-l-lg border border-r-0 border-hairline bg-panel2 text-cream/50 text-sm">
                    +32
                  </span>
                  <input
                    value={phoneLocalDraft}
                    onChange={(e) => setPhoneLocalDraft(e.target.value)}
                    className="w-full bg-deep border border-hairline rounded-r-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-gold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-cream/40 mb-1">E-mail</label>
                <input
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  className="w-full bg-deep border border-hairline rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-[11px] text-cream/40 mb-1">Adres</label>
                <input
                  value={streetDraft}
                  onChange={(e) => setStreetDraft(e.target.value)}
                  placeholder="Straat en huisnummer"
                  className="w-full bg-deep border border-hairline rounded-lg px-2.5 py-1.5 text-sm mb-1.5 focus:outline-none focus:border-gold"
                />
                <div className="flex gap-1.5">
                  <input
                    value={postalCodeDraft}
                    onChange={(e) => setPostalCodeDraft(e.target.value)}
                    placeholder="Postcode"
                    className="w-20 bg-deep border border-hairline rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-gold"
                  />
                  <input
                    value={cityDraft}
                    onChange={(e) => setCityDraft(e.target.value)}
                    placeholder="Gemeente"
                    className="flex-1 bg-deep border border-hairline rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-gold"
                  />
                </div>
              </div>
            </div>
            {contactError && (
              <p className="text-red-400 text-xs mb-2">{contactError}</p>
            )}
            <button
              onClick={saveContactDetails}
              className="text-xs px-3 py-1.5 rounded-full bg-gold-gradient text-deep font-semibold"
            >
              {contactSaved ? "Opgeslagen ✓" : "Opslaan"}
            </button>
            {contactDirty && (
              <p className="text-[11px] text-amber-300/90 mt-1.5 mb-5">
                ⚠ Niet-opgeslagen wijzigingen — gaan verloren als je wegnavigeert zonder op te slaan.
              </p>
            )}
            {!contactDirty && <div className="mb-5" />}

            {defaults && (
              <div className="mb-5 p-3 border border-hairline rounded-lg bg-panel2/40">
                <h3 className="text-xs text-gold/80 uppercase tracking-wide mb-2">
                  Herinneringen (persoonlijk)
                </h3>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-[11px] text-cream/40 mb-1">
                      Lang (uren), standaard {defaults.reminderLongHours}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={longOverride}
                      onChange={(e) => setLongOverride(e.target.value)}
                      placeholder={String(defaults.reminderLongHours)}
                      className="w-full bg-deep border border-hairline rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-cream/40 mb-1">
                      Kort (uren), standaard {defaults.reminderShortHours}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={shortOverride}
                      onChange={(e) => setShortOverride(e.target.value)}
                      placeholder={String(defaults.reminderShortHours)}
                      className="w-full bg-deep border border-hairline rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-cream/30 mb-2">
                  Leeg laten = standaardwaarde gebruiken.
                </p>
                {reminderError && (
                  <p className="text-red-400 text-xs mb-2">{reminderError}</p>
                )}
                <button
                  onClick={saveReminderOverride}
                  className="text-xs px-3 py-1.5 rounded-full bg-gold-gradient text-deep font-semibold"
                >
                  {reminderSaved ? "Opgeslagen ✓" : "Opslaan"}
                </button>
                {reminderOverrideDirty && (
                  <p className="text-[11px] text-amber-300/90 mt-1.5">
                    ⚠ Niet-opgeslagen wijzigingen — gaan verloren als je wegnavigeert zonder op te slaan.
                  </p>
                )}
              </div>
            )}

            {(() => {
              const now = new Date();
              const upcoming = (detail?.bookings || [])
                .filter(
                  (b) =>
                    b.status !== "cancelled" &&
                    new Date(b.start).getTime() > now.getTime()
                )
                .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
              const past = (detail?.bookings || []).filter(
                (b) => !upcoming.some((u) => u.id === b.id)
              );

              return (
                <>
                  <h3 className="text-xs text-gold/80 uppercase tracking-wide mb-2">
                    Volgende afspraken
                  </h3>
                  {!detail ? (
                    <p className="text-xs text-cream/40 mb-4">Laden...</p>
                  ) : upcoming.length === 0 ? (
                    <p className="text-xs text-cream/40 mb-4">
                      Geen aankomende afspraken.
                    </p>
                  ) : (
                    <ul className="space-y-2 text-sm mb-4">
                      {upcoming.map((b) => (
                        <li
                          key={b.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-panel2/40 border border-hairline"
                        >
                          <div>
                            <p className="text-cream/80">{serviceName(b.serviceId)}</p>
                            <p className="text-cream/40 text-xs">
                              {formatDateTime(b.start)}
                            </p>
                          </div>
                          {b.status === "pending" && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300 border border-amber-700/50 shrink-0">
                              aanvraag
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs text-gold/80 uppercase tracking-wide">
                      Historiek
                    </h3>
                    {(detail?.noShowRecords.length || 0) > 0 && (
                      <button
                        onClick={() => setShowNoShowDates((v) => !v)}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-red-950/50 text-red-300 border border-red-800/50 hover:bg-red-900/50 transition"
                      >
                        {detail?.noShowRecords.length}x no show{" "}
                        {showNoShowDates ? "▴" : "▾"}
                      </button>
                    )}
                  </div>

                  {showNoShowDates && (
                    <div className="mb-3 p-2.5 rounded-lg bg-red-950/20 border border-red-800/40">
                      <p className="text-[11px] text-red-300/80 mb-1.5">
                        Niet komen opdagen op (blijvend bewaard, ook na
                        verwijderen uit de agenda):
                      </p>
                      <ul className="space-y-1">
                        {detail?.noShowRecords.map((r) => (
                          <li
                            key={r.id}
                            className="flex items-center justify-between text-xs text-red-300 gap-2"
                          >
                            <span>{r.serviceName}</span>
                            <span className="flex items-center gap-2">
                              {formatDateTime(r.date)}
                              <button
                                onClick={async () => {
                                  if (
                                    !confirm(
                                      "Dit no-show record verwijderen? Gebruik dit enkel bij een misverstand of vergissing."
                                    )
                                  )
                                    return;
                                  await fetch(`/api/no-show-records/${r.id}`, {
                                    method: "DELETE",
                                  });
                                  if (selected) {
                                    fetch(`/api/customers/${selected.id}`)
                                      .then((res) => res.json())
                                      .then((data) =>
                                        setDetail({
                                          bookings: data.bookings,
                                          sales: data.sales,
                                          noShowRecords: data.noShowRecords || [],
                                        })
                                      );
                                  }
                                  fetch("/api/no-show-records")
                                    .then((res) => res.json())
                                    .then(setNoShowRecords);
                                }}
                                className="text-red-400/50 hover:text-red-300"
                                title="Verwijderen (bv. bij een misverstand)"
                              >
                                ✕
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-[10px] text-red-300/40 mt-2">
                        Ging het om een misverstand of vergissing? Verwijder het
                        record gerust met het kruisje hierboven.
                      </p>
                    </div>
                  )}

                  {!detail ? (
                    <p className="text-xs text-cream/40">Laden...</p>
                  ) : past.length === 0 ? (
                    <p className="text-xs text-cream/40">Nog geen eerdere afspraken.</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {past.map((b) => (
                        <li
                          key={b.id}
                          className={`flex justify-between ${
                            b.status === "no_show" ? "text-red-400" : "text-cream/70"
                          }`}
                        >
                          <span>
                            {serviceName(b.serviceId)}
                            {b.status === "no_show" && " · no show"}
                          </span>
                          <span className="text-cream/40 text-xs">
                            {formatDateTime(b.start)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              );
            })()}

            {detail && detail.sales.length > 0 && (
              <>
                {(() => {
                  const perYear = detail.sales.reduce<Record<string, number>>(
                    (acc, s) => {
                      const year = brusselsYear(s.createdAt);
                      acc[year] = (acc[year] || 0) + s.total;
                      return acc;
                    },
                    {}
                  );
                  const years = Object.keys(perYear).sort((a, b) => Number(b) - Number(a));
                  const totalAllTime = detail.sales.reduce((sum, s) => sum + s.total, 0);

                  return (
                    <>
                      <h3 className="text-xs text-gold/80 uppercase tracking-wide mt-4 mb-2">
                        Besteed per jaar
                      </h3>
                      <ul className="space-y-1 text-sm mb-2">
                        {years.map((year) => (
                          <li key={year} className="flex justify-between text-cream/80">
                            <span>{year}</span>
                            <span className="font-display text-gold-light">
                              &euro;{perYear[year].toFixed(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="flex justify-between text-xs text-cream/50 pt-1.5 border-t border-hairline">
                        <span>Totaal (alle jaren)</span>
                        <span className="font-display text-gold-light">
                          &euro;{totalAllTime.toFixed(2)}
                        </span>
                      </p>
                    </>
                  );
                })()}

                <h3 className="text-xs text-gold/80 uppercase tracking-wide mt-4 mb-2">
                  Aankopen
                </h3>
                <ul className="space-y-1 text-sm text-cream/70">
                  {detail.sales.map((s) => (
                    <li key={s.id} className="flex justify-between">
                      <span>{formatDateTime(s.createdAt)}</span>
                      <span className="text-gold-light font-display">
                        &euro;{s.total.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      {showMerge && selected && (
        <MergeCustomerModal
          primary={selected}
          allCustomers={customers}
          onClose={() => setShowMerge(false)}
          onDone={() => {
            setShowMerge(false);
            loadCustomers();
            fetch("/api/bookings").then((r) => r.json()).then(setAllBookings);
            if (selected) {
              fetch(`/api/customers/${selected.id}`)
                .then((r) => r.json())
                .then((data) => setDetail({ bookings: data.bookings, sales: data.sales, noShowRecords: data.noShowRecords || [] }));
            }
          }}
        />
      )}
    </div>
  );
}
