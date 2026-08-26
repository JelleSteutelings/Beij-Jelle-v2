"use client";

import { useEffect, useMemo, useState } from "react";
import { CorrectionRecord, OpeningHours, Service, Settings } from "@/lib/types";
import { useSyncUnsavedChanges } from "../UnsavedChangesContext";

const DAY_LABELS: { key: keyof OpeningHours; label: string }[] = [
  { key: "mon", label: "Maandag" },
  { key: "tue", label: "Dinsdag" },
  { key: "wed", label: "Woensdag" },
  { key: "thu", label: "Donderdag" },
  { key: "fri", label: "Vrijdag" },
  { key: "sat", label: "Zaterdag" },
  { key: "sun", label: "Zondag" },
];

type SettingsDraft = Omit<Settings, "adminPasswordHash">;

const MAX_BLOCKS = 5;

/** Blijvend zichtbare melding zolang een sectie niet-opgeslagen wijzigingen
 * heeft — verdwijnt automatisch zodra er (succesvol) opgeslagen is. */
function UnsavedNotice({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="text-[11px] text-amber-300/90 mt-2 flex items-center gap-1.5">
      <span aria-hidden>⚠</span>
      Niet-opgeslagen wijzigingen — deze gaan verloren als je wegnavigeert zonder op &ldquo;Opslaan&rdquo; te klikken.
    </p>
  );
}

/** Zelfde normalisatie als saveServices gebruikt om naar de API te sturen —
 * ook gebruikt om te vergelijken of er écht iets veranderd is, zodat het
 * enkel uitklappen van "Blokken" (zonder iets aan te passen) niet als
 * wijziging geldt. */
function serviceSavePayload(s: Service) {
  const base = s.blocks && s.blocks.length > 0 ? s.blocks : [{ durationMinutes: s.durationMinutes, busy: true }];
  const padded = [...base];
  while (padded.length < MAX_BLOCKS) padded.push({ durationMinutes: 0, busy: true });
  const usedBlocks = padded.slice(0, MAX_BLOCKS).filter((b) => b.durationMinutes > 0);
  const durationMinutes =
    usedBlocks.length > 0
      ? usedBlocks.reduce((sum, b) => sum + b.durationMinutes, 0)
      : s.durationMinutes;
  // Blok 1 volgt altijd de hoofdkleur (geen eigen kleur op te slaan); latere
  // blokken behouden hun eigen kleur indien ingesteld.
  const normalizedBlocks = usedBlocks.map((b, i) =>
    i === 0 ? { durationMinutes: b.durationMinutes, busy: b.busy } : { ...b }
  );
  return {
    id: s.id,
    price: s.price,
    durationMinutes,
    active: s.active,
    color: s.color,
    blocks: normalizedBlocks.length > 1 ? normalizedBlocks : undefined,
  };
}

function servicesEqual(a: Service[], b: Service[]): boolean {
  return JSON.stringify(a.map(serviceSavePayload)) === JSON.stringify(b.map(serviceSavePayload));
}

export default function InstellingenPage() {
  const [settings, setSettings] = useState<SettingsDraft | null>(null);
  const [savedSettings, setSavedSettings] = useState<SettingsDraft | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [savedServices, setSavedServices] = useState<Service[]>([]);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [showNewService, setShowNewService] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceCategory, setNewServiceCategory] = useState("");
  const [newServiceCategoryInput, setNewServiceCategoryInput] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState("");
  const [newServiceError, setNewServiceError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [savedMsgIsError, setSavedMsgIsError] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("Gerry.steutelings@telenet.be");
  const [testEmailStatus, setTestEmailStatus] = useState<string | null>(null);
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Correcties (kassaverrichtingen ongedaan gemaakt) — bewust achter een
  // extra wachtwoordcontrole, los van de gewone admin-login, zodat dit niet
  // per ongeluk zomaar openligt.
  const [correctionsUnlocked, setCorrectionsUnlocked] = useState(false);
  const [correctionsPromptOpen, setCorrectionsPromptOpen] = useState(false);
  const [correctionsPasswordInput, setCorrectionsPasswordInput] = useState("");
  const [correctionsError, setCorrectionsError] = useState<string | null>(null);
  const [correctionsLoading, setCorrectionsLoading] = useState(false);
  const [corrections, setCorrections] = useState<CorrectionRecord[]>([]);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((data) => {
      setSettings(data);
      setSavedSettings(data);
    });
    fetch("/api/services").then((r) => r.json()).then((data) => {
      setServices(data);
      setSavedServices(data);
    });
  }, []);

  function flash(msg: string, isError = false) {
    setSavedMsg(msg);
    setSavedMsgIsError(isError);
    setTimeout(() => setSavedMsg(null), isError ? 4000 : 2500);
  }

  const businessInfoDirty = useMemo(() => {
    if (!settings || !savedSettings) return false;
    const fields: (keyof SettingsDraft)[] = [
      "businessName", "ownerName", "address", "postalCity", "phone",
      "vatNumber", "bankAccountNumber", "facebookUrl", "instagramUrl",
    ];
    return fields.some((f) => (settings[f] || "") !== (savedSettings[f] || ""));
  }, [settings, savedSettings]);

  const openingHoursDirty = useMemo(() => {
    if (!settings || !savedSettings) return false;
    return JSON.stringify(settings.openingHours) !== JSON.stringify(savedSettings.openingHours);
  }, [settings, savedSettings]);

  const remindersDirty = useMemo(() => {
    if (!settings || !savedSettings) return false;
    return (
      settings.reminderLongHours !== savedSettings.reminderLongHours ||
      settings.reminderShortHours !== savedSettings.reminderShortHours
    );
  }, [settings, savedSettings]);

  const studentDiscountDirty = useMemo(() => {
    if (!settings || !savedSettings) return false;
    return settings.studentDiscountPercent !== savedSettings.studentDiscountPercent;
  }, [settings, savedSettings]);

  const servicesDirty = useMemo(() => {
    if (services.length === 0) return false;
    return !servicesEqual(services, savedServices);
  }, [services, savedServices]);

  const existingCategories = useMemo(() => {
    return Array.from(new Set(services.map((s) => s.category))).sort();
  }, [services]);

  const passwordDirty = newPassword.trim().length > 0;

  const newServiceDraftDirty =
    showNewService &&
    (newServiceName.trim().length > 0 ||
      newServicePrice.trim().length > 0 ||
      newServiceDuration.trim().length > 0);

  useSyncUnsavedChanges(
    businessInfoDirty ||
      openingHoursDirty ||
      remindersDirty ||
      studentDiscountDirty ||
      servicesDirty ||
      passwordDirty ||
      newServiceDraftDirty
  );

  async function saveBusinessInfo() {
    if (!settings) return;
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: settings.businessName,
        ownerName: settings.ownerName,
        address: settings.address,
        postalCity: settings.postalCity,
        phone: settings.phone,
        vatNumber: settings.vatNumber,
        bankAccountNumber: settings.bankAccountNumber,
        facebookUrl: settings.facebookUrl,
        instagramUrl: settings.instagramUrl,
      }),
    });
    if (!res.ok) {
      flash("Opslaan van bedrijfsgegevens is mislukt. Probeer opnieuw.", true);
      return;
    }
    setSavedSettings((prev) => (prev ? { ...prev, ...settings } : settings));
    flash("Bedrijfsgegevens opgeslagen.");
  }

  async function saveReminders() {
    if (!settings) return;
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reminderLongHours: settings.reminderLongHours,
        reminderShortHours: settings.reminderShortHours,
      }),
    });
    if (!res.ok) {
      flash("Opslaan van herinneringstijden is mislukt. Probeer opnieuw.", true);
      return;
    }
    setSavedSettings((prev) =>
      prev
        ? { ...prev, reminderLongHours: settings.reminderLongHours, reminderShortHours: settings.reminderShortHours }
        : settings
    );
    flash("Herinneringstijden opgeslagen.");
  }

  async function saveStudentDiscount() {
    if (!settings) return;
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentDiscountPercent: settings.studentDiscountPercent,
      }),
    });
    if (!res.ok) {
      flash("Opslaan van studentenkorting is mislukt. Probeer opnieuw.", true);
      return;
    }
    setSavedSettings((prev) =>
      prev ? { ...prev, studentDiscountPercent: settings.studentDiscountPercent } : settings
    );
    flash("Studentenkorting opgeslagen.");
  }

  async function saveOpeningHours() {
    if (!settings) return;
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingHours: settings.openingHours }),
    });
    if (!res.ok) {
      flash("Opslaan van richturen is mislukt. Probeer opnieuw.", true);
      return;
    }
    setSavedSettings((prev) => (prev ? { ...prev, openingHours: settings.openingHours } : settings));
    flash("Richturen opgeslagen.");
  }

  function blocksForEditing(s: Service): { durationMinutes: number; busy: boolean; color?: string }[] {
    const base = s.blocks && s.blocks.length > 0 ? s.blocks : [{ durationMinutes: s.durationMinutes, busy: true }];
    const padded = [...base];
    while (padded.length < MAX_BLOCKS) padded.push({ durationMinutes: 0, busy: true });
    return padded.slice(0, MAX_BLOCKS);
  }

  function toggleExpand(s: Service) {
    if (expandedServiceId === s.id) {
      setExpandedServiceId(null);
      return;
    }
    if (!s.blocks) {
      const updated = services.map((svc) =>
        svc.id === s.id ? { ...svc, blocks: blocksForEditing(svc) } : svc
      );
      setServices(updated);
    }
    setExpandedServiceId(s.id);
  }

  function updateBlock(
    serviceId: string,
    blockIndex: number,
    field: "durationMinutes" | "busy" | "color",
    value: number | boolean | string | undefined
  ) {
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== serviceId) return s;
        const blocks = blocksForEditing(s);
        blocks[blockIndex] = { ...blocks[blockIndex], [field]: value };
        return { ...s, blocks };
      })
    );
  }

  function updateColor(serviceId: string, color: string) {
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, color } : s))
    );
  }

  async function saveServices() {
    const res = await fetch("/api/services", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(services.map(serviceSavePayload)),
    });
    if (!res.ok) {
      flash("Opslaan van diensten is mislukt. Je wijzigingen staan nog klaar — probeer opnieuw.", true);
      return;
    }
    setSavedServices(services);
    setExpandedServiceId(null);
    flash("Diensten opgeslagen.");
  }

  const [newServiceSubmitting, setNewServiceSubmitting] = useState(false);

  async function createService() {
    if (newServiceSubmitting) return;
    if (!newServiceName.trim()) {
      setNewServiceError("Vul een naam in.");
      return;
    }
    const category = newServiceCategory === "__new__" ? newServiceCategoryInput.trim() : newServiceCategory;
    if (!category) {
      setNewServiceError("Kies of typ een categorie.");
      return;
    }
    setNewServiceError(null);
    setNewServiceSubmitting(true);
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newServiceName.trim(),
        category,
        price: newServicePrice ? Number(newServicePrice) : 0,
        durationMinutes: newServiceDuration ? Number(newServiceDuration) : 30,
      }),
    });
    setNewServiceSubmitting(false);
    if (!res.ok) {
      setNewServiceError("Aanmaken is mislukt. Je gegevens staan nog klaar — probeer opnieuw.");
      return;
    }
    const created: Service = await res.json();
    setServices((prev) => [...prev, created]);
    setSavedServices((prev) => [...prev, created]);
    setNewServiceName("");
    setNewServiceCategory(created.category);
    setNewServiceCategoryInput("");
    setNewServicePrice("");
    setNewServiceDuration("");
    setShowNewService(false);
    flash("Dienst toegevoegd.");
  }

  async function deleteService(s: Service) {
    if (
      !confirm(
        `"${s.name}" definitief verwijderen? Dit kan niet ongedaan gemaakt worden.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/services/${s.id}`, { method: "DELETE" });
    if (!res.ok) {
      flash("Verwijderen is mislukt. Probeer opnieuw.", true);
      return;
    }
    setServices((prev) => prev.filter((x) => x.id !== s.id));
    setSavedServices((prev) => prev.filter((x) => x.id !== s.id));
    if (expandedServiceId === s.id) setExpandedServiceId(null);
    flash("Dienst verwijderd.");
  }

  async function savePassword() {
    if (newPassword.length < 6) {
      flash("Wachtwoord moet minstens 6 tekens hebben.", true);
      return;
    }
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    if (!res.ok) {
      flash("Wijzigen van wachtwoord is mislukt. Probeer opnieuw.", true);
      return;
    }
    setNewPassword("");
    flash("Wachtwoord gewijzigd.");
  }

  async function unlockCorrections() {
    setCorrectionsError(null);
    setCorrectionsLoading(true);
    const res = await fetch("/api/settings/verify-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: correctionsPasswordInput }),
    });
    if (!res.ok) {
      setCorrectionsLoading(false);
      setCorrectionsError("Ongeldig wachtwoord.");
      return;
    }
    const corrRes = await fetch("/api/corrections");
    const corrData = await corrRes.json();
    setCorrections(corrData);
    setCorrectionsUnlocked(true);
    setCorrectionsPasswordInput("");
    setCorrectionsLoading(false);
  }

  function lockCorrections() {
    setCorrectionsUnlocked(false);
    setCorrections([]);
    setCorrectionsPasswordInput("");
    setCorrectionsError(null);
    setCorrectionsPromptOpen(false);
  }

  function updateDay(day: keyof OpeningHours, field: "start" | "end", value: string) {
    if (!settings) return;
    setSettings({
      ...settings,
      openingHours: {
        ...settings.openingHours,
        [day]: [{ ...(settings.openingHours[day][0] || { start: "09:00", end: "18:00" }), [field]: value }],
      },
    });
  }

  function toggleDayClosed(day: keyof OpeningHours) {
    if (!settings) return;
    const isOpen = settings.openingHours[day].length > 0;
    setSettings({
      ...settings,
      openingHours: {
        ...settings.openingHours,
        [day]: isOpen ? [] : [{ start: "09:00", end: "18:00" }],
      },
    });
  }

  async function sendTestEmail() {
    setTestEmailSending(true);
    setTestEmailStatus(null);
    const res = await fetch("/api/settings/test-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testEmailTo }),
    });
    const data = await res.json().catch(() => ({}));
    setTestEmailSending(false);
    setTestEmailStatus(
      res.ok
        ? `Testmail verstuurd naar ${testEmailTo}. Kijk in de mailbox (ook spam).`
        : data.error || "Er ging iets mis."
    );
  }

  if (!settings) {
    return <div className="p-10 text-cream/40 text-sm">Laden...</div>;
  }

  return (
    <div className="p-6 sm:p-10 max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl">Instellingen</h1>
        {savedMsg && (
          <span
            className={`text-xs px-3 py-1.5 rounded-full border ${
              savedMsgIsError
                ? "text-red-400 bg-red-950/30 border-red-800/60"
                : "text-gold bg-panel border-hairline"
            }`}
          >
            {savedMsgIsError ? "⚠ " : "✓ "}
            {savedMsg}
          </span>
        )}
      </div>

      {/* BEDRIJFSGEGEVENS */}
      <section className="mb-12">
        <h2 className="font-display text-lg text-gold mb-4">Bedrijfsgegevens</h2>
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs text-cream/50 mb-1">Salonnaam</label>
            <input
              value={settings.businessName}
              onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
              className="w-full bg-panel border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Eigenaar</label>
            <input
              value={settings.ownerName}
              onChange={(e) => setSettings({ ...settings, ownerName: e.target.value })}
              className="w-full bg-panel border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Adres</label>
            <input
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full bg-panel border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Postcode &amp; gemeente</label>
            <input
              value={settings.postalCity}
              onChange={(e) => setSettings({ ...settings, postalCity: e.target.value })}
              className="w-full bg-panel border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">GSM</label>
            <input
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="w-full bg-panel border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">BTW-nummer</label>
            <input
              value={settings.vatNumber || ""}
              onChange={(e) => setSettings({ ...settings, vatNumber: e.target.value })}
              placeholder="BE0123.456.789"
              className="w-full bg-panel border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Bankrekeningnummer (IBAN)</label>
            <input
              value={settings.bankAccountNumber || ""}
              onChange={(e) => setSettings({ ...settings, bankAccountNumber: e.target.value })}
              placeholder="BE00 0000 0000 0000"
              className="w-full bg-panel border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Facebook URL</label>
            <input
              value={settings.facebookUrl || ""}
              onChange={(e) => setSettings({ ...settings, facebookUrl: e.target.value })}
              className="w-full bg-panel border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Instagram URL</label>
            <input
              value={settings.instagramUrl || ""}
              onChange={(e) => setSettings({ ...settings, instagramUrl: e.target.value })}
              className="w-full bg-panel border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
        </div>
        <button
          onClick={saveBusinessInfo}
          className="text-xs px-4 py-2 rounded-full bg-gold-gradient text-deep font-semibold"
        >
          Opslaan
        </button>
        <UnsavedNotice show={businessInfoDirty} />
      </section>

      {/* OPENINGSUREN */}
      <section className="mb-12">
        <h2 className="font-display text-lg text-gold mb-1">Richturen</h2>
        <p className="text-xs text-cream/40 mb-4">
          Indicatief &mdash; buiten deze uren kunnen klanten nog steeds een
          moment aanvragen, dat jij zelf bevestigt.
        </p>
        <div className="space-y-2 mb-4">
          {DAY_LABELS.map(({ key, label }) => {
            const range = settings.openingHours[key][0];
            const isOpen = settings.openingHours[key].length > 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <button
                  onClick={() => toggleDayClosed(key)}
                  className={`w-24 shrink-0 text-xs py-1.5 rounded-full border transition ${
                    isOpen
                      ? "border-gold text-gold"
                      : "border-hairline text-cream/40"
                  }`}
                >
                  {label}
                </button>
                {isOpen ? (
                  <>
                    <input
                      type="time"
                      value={range?.start || "09:00"}
                      onChange={(e) => updateDay(key, "start", e.target.value)}
                      className="bg-panel border border-hairline rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-gold [color-scheme:dark]"
                    />
                    <span className="text-cream/30">tot</span>
                    <input
                      type="time"
                      value={range?.end || "18:00"}
                      onChange={(e) => updateDay(key, "end", e.target.value)}
                      className="bg-panel border border-hairline rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-gold [color-scheme:dark]"
                    />
                  </>
                ) : (
                  <span className="text-xs text-cream/30">Gesloten</span>
                )}
              </div>
            );
          })}
        </div>
        <button
          onClick={saveOpeningHours}
          className="text-xs px-4 py-2 rounded-full bg-gold-gradient text-deep font-semibold"
        >
          Opslaan
        </button>
        <UnsavedNotice show={openingHoursDirty} />
      </section>

      {/* DIENSTEN */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-gold">Diensten &amp; prijzen</h2>
          <button
            onClick={() => setShowNewService((v) => !v)}
            className="text-xs border border-hairline hover:border-gold rounded-full px-4 py-2 transition"
          >
            + Nieuwe dienst
          </button>
        </div>

        {showNewService && (
          <div className="mb-5 p-4 border border-hairline rounded-xl bg-panel/40 grid sm:grid-cols-4 gap-2 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs text-cream/50 mb-1">Naam</label>
              <input
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Categorie</label>
              <select
                value={newServiceCategory}
                onChange={(e) => setNewServiceCategory(e.target.value)}
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
              >
                <option value="">Kies...</option>
                {existingCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__new__">+ Nieuwe categorie...</option>
              </select>
            </div>
            {newServiceCategory === "__new__" && (
              <div>
                <label className="block text-xs text-cream/50 mb-1">Nieuwe categorie</label>
                <input
                  value={newServiceCategoryInput}
                  onChange={(e) => setNewServiceCategoryInput(e.target.value)}
                  className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-cream/50 mb-1">Prijs (&euro;)</label>
              <input
                type="number"
                min={0}
                value={newServicePrice}
                onChange={(e) => setNewServicePrice(e.target.value)}
                placeholder="0"
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Duur (min)</label>
              <input
                type="number"
                min={5}
                step={5}
                value={newServiceDuration}
                onChange={(e) => setNewServiceDuration(e.target.value)}
                placeholder="30"
                className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
              />
            </div>
            <button
              onClick={createService}
              disabled={newServiceSubmitting}
              className="text-xs px-4 py-2 rounded-full bg-gold-gradient text-deep font-semibold h-fit disabled:opacity-40"
            >
              {newServiceSubmitting ? "Bezig..." : "Toevoegen"}
            </button>
            {newServiceError && (
              <p className="text-red-400 text-xs sm:col-span-4">{newServiceError}</p>
            )}
          </div>
        )}

        <div className="space-y-1.5 mb-4">
          {services.map((s, i) => (
            <div key={s.id} className="border border-transparent rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.active}
                  onChange={(e) => {
                    const updated = [...services];
                    updated[i] = { ...s, active: e.target.checked };
                    setServices(updated);
                  }}
                  className="accent-[#e0a83f]"
                />
                <input
                  type="color"
                  value={s.color || "#e0a83f"}
                  onChange={(e) => updateColor(s.id, e.target.value)}
                  className="w-7 h-7 rounded-full border border-hairline shrink-0 cursor-pointer bg-transparent p-0"
                  title="Kleur in de agenda"
                />
                <span className="flex-1 truncate text-cream/80">{s.name}</span>
                <span className="text-cream/30 text-xs">&euro;</span>
                <input
                  type="number"
                  value={s.price}
                  onChange={(e) => {
                    const updated = [...services];
                    updated[i] = { ...s, price: Number(e.target.value) };
                    setServices(updated);
                  }}
                  className="w-16 bg-panel border border-hairline rounded-lg px-2 py-1 text-center"
                />
                <input
                  type="number"
                  value={s.durationMinutes}
                  onChange={(e) => {
                    const updated = [...services];
                    updated[i] = { ...s, durationMinutes: Number(e.target.value) };
                    setServices(updated);
                  }}
                  className="w-16 bg-panel border border-hairline rounded-lg px-2 py-1 text-center"
                />
                <span className="text-cream/30 text-xs w-8">min</span>
                <button
                  onClick={() => toggleExpand(s)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border shrink-0 transition ${
                    expandedServiceId === s.id
                      ? "border-gold text-gold"
                      : "border-hairline text-cream/40 hover:border-gold"
                  }`}
                >
                  Blokken {s.blocks && s.blocks.length > 1 ? `(${s.blocks.length})` : ""}
                </button>
                <button
                  onClick={() => deleteService(s)}
                  title="Dienst verwijderen"
                  className="text-cream/25 hover:text-red-400 shrink-0 px-1 transition"
                >
                  &times;
                </button>
              </div>

              {expandedServiceId === s.id && (
                <div className="mt-2 mb-3 ml-6 p-3 border border-hairline rounded-lg bg-panel2/40">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="text-[11px] text-cream/40">
                      Verdeel deze dienst in maximaal 5 blokken. &ldquo;Bezet&rdquo; = Jelle is
                      actief bezig; &ldquo;Vrij&rdquo; = wachttijd (bv. inwerktijd kleuring)
                      waarin een andere klant ingepland kan worden. Zet een blok op 0 minuten
                      om het niet te gebruiken.
                    </p>
                    <button
                      onClick={() => setExpandedServiceId(null)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-hairline hover:border-gold text-cream/50 hover:text-gold shrink-0 transition"
                    >
                      Sluiten
                    </button>
                  </div>
                  <div className="space-y-2">
                    {blocksForEditing(s).map((b, bi) => (
                      <div key={bi} className="flex items-center gap-2">
                        <span className="text-[11px] text-cream/40 w-14 shrink-0">
                          Blok {bi + 1}
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={b.durationMinutes}
                          onChange={(e) =>
                            updateBlock(s.id, bi, "durationMinutes", Number(e.target.value))
                          }
                          className="w-16 bg-deep border border-hairline rounded-lg px-2 py-1 text-center text-sm"
                        />
                        <span className="text-[11px] text-cream/30">min</span>
                        <button
                          onClick={() => updateBlock(s.id, bi, "busy", !b.busy)}
                          disabled={b.durationMinutes === 0}
                          className={`text-[11px] px-2.5 py-1 rounded-full border transition disabled:opacity-30 ${
                            b.busy
                              ? "border-amber-600/60 text-amber-300 bg-amber-900/20"
                              : "border-emerald-600/60 text-emerald-300 bg-emerald-900/20"
                          }`}
                        >
                          {b.busy ? "Bezet" : "Vrij"}
                        </button>
                        {bi === 0 ? (
                          <span
                            title="Blok 1 volgt altijd de hoofdkleur van de dienst"
                            className="flex items-center gap-1 text-[10px] text-cream/30"
                          >
                            <span
                              className="w-5 h-5 rounded-full border border-hairline shrink-0"
                              style={{ backgroundColor: s.color || "#e0a83f" }}
                            />
                            hoofdkleur
                          </span>
                        ) : b.durationMinutes > 0 && b.busy ? (
                          <span className="flex items-center gap-1">
                            <input
                              type="color"
                              value={b.color || s.color || "#e0a83f"}
                              onChange={(e) => updateBlock(s.id, bi, "color", e.target.value)}
                              className="w-6 h-6 rounded-full border border-hairline shrink-0 cursor-pointer bg-transparent p-0"
                              title="Eigen kleur voor dit blok"
                            />
                            {b.color && (
                              <button
                                onClick={() => updateBlock(s.id, bi, "color", undefined)}
                                title="Terug naar hoofdkleur"
                                className="text-[10px] text-cream/30 hover:text-gold px-1"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-cream/30 mt-3">
                    Een blok met een eigen kleur krijgt in de agenda die kleur, met links een
                    smalle baan in de hoofdkleur — zo blijft duidelijk bij welke dienst het hoort.
                  </p>
                  <p className="text-[11px] text-cream/30 mt-1">
                    Totale duur:{" "}
                    {blocksForEditing(s)
                      .filter((b) => b.durationMinutes > 0)
                      .reduce((sum, b) => sum + b.durationMinutes, 0)}{" "}
                    min
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={saveServices}
          className="text-xs px-4 py-2 rounded-full bg-gold-gradient text-deep font-semibold"
        >
          Opslaan
        </button>
        <UnsavedNotice show={servicesDirty} />
      </section>

      {/* HERINNERINGEN */}
      <section className="mb-12">
        <h2 className="font-display text-lg text-gold mb-1">Herinneringen</h2>
        <p className="text-xs text-cream/40 mb-4">
          Klanten met een e-mailadres krijgen automatisch twee herinneringen
          voor hun afspraak (indien e-mail is ingesteld, zie README). Elke
          klant kan hier persoonlijk van afwijken via Klanten.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs text-cream/50 mb-1">
              Lange herinnering (uren op voorhand)
            </label>
            <input
              type="number"
              min={0}
              value={settings.reminderLongHours}
              onChange={(e) =>
                setSettings({ ...settings, reminderLongHours: Number(e.target.value) })
              }
              className="w-full bg-panel border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
            <p className="text-[11px] text-cream/30 mt-1">Standaard: 24 (= een dag op voorhand)</p>
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">
              Korte herinnering (uren op voorhand)
            </label>
            <input
              type="number"
              min={0}
              value={settings.reminderShortHours}
              onChange={(e) =>
                setSettings({ ...settings, reminderShortHours: Number(e.target.value) })
              }
              className="w-full bg-panel border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
            <p className="text-[11px] text-cream/30 mt-1">Standaard: 2 (= twee uur op voorhand)</p>
          </div>
        </div>
        <button
          onClick={saveReminders}
          className="text-xs px-4 py-2 rounded-full bg-gold-gradient text-deep font-semibold"
        >
          Opslaan
        </button>
        <UnsavedNotice show={remindersDirty} />
      </section>

      {/* STUDENTENKORTING */}
      <section className="mb-12">
        <h2 className="font-display text-lg text-gold mb-1">Studentenkorting</h2>
        <p className="text-xs text-cream/40 mb-4">
          Percentage dat toegepast wordt wanneer &ldquo;Studentenkorting
          toegepast&rdquo; aangevinkt wordt in de kassa.
        </p>
        <div className="flex items-center gap-2 mb-4">
          <input
            type="number"
            min={0}
            max={100}
            value={settings.studentDiscountPercent}
            onChange={(e) =>
              setSettings({ ...settings, studentDiscountPercent: Number(e.target.value) })
            }
            className="w-24 bg-panel border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
          />
          <span className="text-cream/60">%</span>
        </div>
        <button
          onClick={saveStudentDiscount}
          className="text-xs px-4 py-2 rounded-full bg-gold-gradient text-deep font-semibold"
        >
          Opslaan
        </button>
        <UnsavedNotice show={studentDiscountDirty} />
      </section>

      {/* WACHTWOORD */}
      <section className="mb-12">
        <h2 className="font-display text-lg text-gold mb-4">Wachtwoord wijzigen</h2>
        <div className="flex gap-2 items-end">
          <div>
            <label className="block text-xs text-cream/50 mb-1">Nieuw wachtwoord</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-panel border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <button
            onClick={savePassword}
            className="text-xs px-4 py-2 rounded-full bg-gold-gradient text-deep font-semibold h-fit"
          >
            Wijzigen
          </button>
        </div>
        <UnsavedNotice show={passwordDirty} />
      </section>

      {/* QR BETALING */}
      <section>
        <h2 className="font-display text-lg text-gold mb-1">QR-betaling</h2>
        <p className="text-xs text-cream/40 mb-4">
          Upload je eigen Payconiq/Bancontact QR-afbeelding (bv. een
          schermafbeelding van de app of de QR-sticker van je bank). Deze
          wordt getoond aan de kassa wanneer je &ldquo;QR-code&rdquo; kiest
          als betaalwijze.
        </p>
        <div className="flex items-start gap-4">
          {settings.qrImageDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.qrImageDataUrl}
              alt="QR-betaling"
              className="w-28 h-28 object-contain rounded-lg border border-hairline bg-deep"
            />
          ) : (
            <div className="w-28 h-28 rounded-lg border border-dashed border-hairline flex items-center justify-center text-xs text-cream/30 text-center px-2">
              Nog geen QR ingesteld
            </div>
          )}
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async () => {
                  const dataUrl = reader.result as string;
                  const res = await fetch("/api/settings", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ qrImageDataUrl: dataUrl }),
                  });
                  if (!res.ok) {
                    flash("Opslaan van QR-afbeelding is mislukt. Probeer opnieuw.", true);
                    return;
                  }
                  setSettings({ ...settings, qrImageDataUrl: dataUrl });
                  setSavedSettings((prev) => (prev ? { ...prev, qrImageDataUrl: dataUrl } : prev));
                  flash("QR-afbeelding opgeslagen.");
                };
                reader.readAsDataURL(file);
              }}
              className="text-xs text-cream/60"
            />
            {settings.qrImageDataUrl && (
              <button
                onClick={async () => {
                  const res = await fetch("/api/settings", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ qrImageDataUrl: "" }),
                  });
                  if (!res.ok) {
                    flash("Verwijderen van QR-afbeelding is mislukt. Probeer opnieuw.", true);
                    return;
                  }
                  setSettings({ ...settings, qrImageDataUrl: "" });
                  setSavedSettings((prev) => (prev ? { ...prev, qrImageDataUrl: "" } : prev));
                  flash("QR-afbeelding verwijderd.");
                }}
                className="block text-xs text-cream/40 hover:text-red-400"
              >
                Verwijderen
              </button>
            )}
          </div>
        </div>
      </section>

      {/* TEST E-MAIL */}
      <section className="mt-12">
        <h2 className="font-display text-lg text-gold mb-1">Test e-mail versturen</h2>
        <p className="text-xs text-cream/40 mb-4">
          Stuur een eenvoudig testbericht om te controleren of de
          e-mailinstelling (Resend) correct werkt, zonder eerst een echte
          boeking te moeten maken.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={testEmailTo}
            onChange={(e) => setTestEmailTo(e.target.value)}
            placeholder="naam@email.be"
            className="bg-panel border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold min-w-[240px]"
          />
          <button
            onClick={sendTestEmail}
            disabled={testEmailSending || !testEmailTo.trim()}
            className="text-xs px-4 py-2 rounded-full bg-gold-gradient text-deep font-semibold disabled:opacity-40"
          >
            {testEmailSending ? "Bezig..." : "Verstuur testmail"}
          </button>
        </div>
        {testEmailStatus && (
          <p className="text-xs text-cream/60 mt-2">{testEmailStatus}</p>
        )}
      </section>

      {/* BACK-UP */}
      <section className="mt-12">
        <h2 className="font-display text-lg text-gold mb-1">Back-up</h2>
        <p className="text-xs text-cream/40 mb-4">
          Al je gegevens (afspraken, klanten, voorraad, verkopen,
          instellingen) staan in één bestand. Download regelmatig — zeker
          in het begin — een kopie en bewaar die ergens veilig (bv. je
          e-mail of Google Drive).
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/backup/excel"
            download
            className="inline-block text-xs px-4 py-2 rounded-full bg-gold-gradient text-deep font-semibold"
          >
            Download als Excel (leesbaar)
          </a>
          <a
            href="/api/backup"
            download
            className="inline-block text-xs px-4 py-2 rounded-full border border-hairline hover:border-gold transition"
          >
            Download ruwe back-up (JSON)
          </a>
        </div>
        <p className="text-[11px] text-cream/30 mt-2">
          De Excel-versie is enkel om te bekijken/bewaren (bv. voor de
          boekhouder). Om echt terug te zetten na een probleem, gebruik je
          de JSON-versie.
        </p>
      </section>

      {/* CORRECTIES — bewust minimalistisch, achteraan de pagina */}
      <div className="mt-16 pt-6 border-t border-hairline/30">
        {!correctionsPromptOpen ? (
          <button
            onClick={() => setCorrectionsPromptOpen(true)}
            className="text-xs text-cream/25 hover:text-cream/50 transition"
          >
            Correcties bekijken
          </button>
        ) : !correctionsUnlocked ? (
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-cream/50 mb-1">Wachtwoord</label>
              <input
                type="password"
                autoFocus
                value={correctionsPasswordInput}
                onChange={(e) => setCorrectionsPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && unlockCorrections()}
                className="bg-panel border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
              />
            </div>
            <button
              onClick={unlockCorrections}
              disabled={correctionsLoading || !correctionsPasswordInput}
              className="text-xs px-4 py-2 rounded-full bg-gold-gradient text-deep font-semibold h-fit disabled:opacity-40"
            >
              {correctionsLoading ? "Bezig..." : "Bevestigen"}
            </button>
            <button
              onClick={() => {
                setCorrectionsPromptOpen(false);
                setCorrectionsPasswordInput("");
                setCorrectionsError(null);
              }}
              className="text-xs text-cream/30 hover:text-cream/50 h-fit py-2"
            >
              annuleren
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg text-gold">Correcties</h2>
              <button
                onClick={lockCorrections}
                className="text-xs text-cream/40 hover:text-gold"
              >
                Vergrendelen
              </button>
            </div>
            {corrections.length === 0 ? (
              <p className="text-cream/40 text-sm">Nog geen correcties geregistreerd.</p>
            ) : (
              <ul className="space-y-2">
                {corrections.map((c) => (
                  <li
                    key={c.id}
                    className="px-4 py-3 rounded-xl border border-dashed border-hairline/60 bg-panel/10"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-cream/60">
                        {new Date(c.correctedAt).toLocaleString("nl-BE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Europe/Brussels",
                        })}{" "}
                        &middot; {c.customerName || "—"}
                        {c.serviceName ? ` · ${c.serviceName}` : ""}
                      </p>
                      <p className="text-sm text-cream/50 shrink-0">
                        €{c.originalTotal.toFixed(2)}
                      </p>
                    </div>
                    <p className="text-[11px] text-cream/35 italic mt-0.5">
                      Reden: {c.reason}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {correctionsError && (
          <p className="text-red-400 text-xs mt-2">{correctionsError}</p>
        )}
      </div>
    </div>
  );
}
