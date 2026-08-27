"use client";

import { useState } from "react";

/** Zelfde whitelist als de API — enkel deze lijsten zijn hier te wissen.
 * Diensten & prijzen, producten & voorraad-aantallen, klanten en
 * instellingen staan hier bewust niet bij: die kan je via dit scherm
 * nooit verwijderen. */
const GROUPS: {
  title: string;
  hint: string;
  items: { key: string; label: string; hint?: string }[];
}[] = [
  {
    title: "Agenda",
    hint: "Alles wat met de planning te maken heeft.",
    items: [
      { key: "bookings", label: "Afspraken & blokkeringen" },
      { key: "cancellationRecords", label: "Annulatiegeschiedenis" },
      { key: "noShowRecords", label: "No-show geschiedenis" },
    ],
  },
  {
    title: "Financieel",
    hint: "Alles wat met verkopen en kassa te maken heeft.",
    items: [
      { key: "sales", label: "Kassaverkopen" },
      { key: "dayClosings", label: "Dagafsluitingen" },
      { key: "correctionRecords", label: "Correctielog (kassa)" },
    ],
  },
  {
    title: "Overige (kies zelf)",
    hint: "Niet zuiver agenda of financieel — bekijk per geval of je dit wilt behouden.",
    items: [
      { key: "giftVouchers", label: "Cadeaubonnen" },
      {
        key: "purchaseOrders",
        label: "Inkooporders",
        hint: "bestellingen bij je leverancier",
      },
      {
        key: "stockMovements",
        label: "Voorraadgeschiedenis",
        hint: "in/uit-bewegingen — je huidige voorraadaantallen per product blijven hoe dan ook staan",
      },
    ],
  },
];

const AGENDA_EN_FINANCIEEL = ["bookings", "cancellationRecords", "noShowRecords", "sales", "dayClosings", "correctionRecords"];

const LABELS: Record<string, string> = Object.fromEntries(
  GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label]))
);

export default function LivegangPage() {
  const [promptOpen, setPromptOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockLoading, setUnlockLoading] = useState(false);

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [result, setResult] = useState<Record<string, number> | null>(null);

  async function loadCounts() {
    const res = await fetch("/api/settings/reset-data");
    if (res.ok) {
      const data = await res.json();
      setCounts(data.counts || {});
    }
  }

  async function unlock() {
    setUnlockError(null);
    setUnlockLoading(true);
    const res = await fetch("/api/settings/verify-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: unlockPassword }),
    });
    if (!res.ok) {
      setUnlockLoading(false);
      setUnlockError("Ongeldig wachtwoord.");
      return;
    }
    await loadCounts();
    setUnlocked(true);
    setUnlockPassword("");
    setUnlockLoading(false);
  }

  function lock() {
    setUnlocked(false);
    setPromptOpen(false);
    setUnlockPassword("");
    setUnlockError(null);
    setSelected(new Set());
    setResult(null);
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectPreset() {
    setSelected(new Set(AGENDA_EN_FINANCIEEL));
  }

  function selectNone() {
    setSelected(new Set());
  }

  async function submitDelete() {
    setConfirmError(null);
    setConfirmLoading(true);
    const res = await fetch("/api/settings/reset-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: confirmPassword,
        // De gebruiker heeft net expliciet "Ja, verwijderen" geklikt na de
        // vraag "Ben je zeker...?" — dat IS de bevestiging, dus die sturen
        // we hier automatisch mee (geen apart woord meer te typen).
        confirm: "VERWIJDER",
        lists: Array.from(selected),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setConfirmLoading(false);
    if (!res.ok) {
      setConfirmError(data.error || "Er ging iets mis.");
      return;
    }
    setResult(data.deleted);
    setConfirmOpen(false);
    setConfirmPassword("");
    setSelected(new Set());
    await loadCounts();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-2xl text-gold mb-1">Livegang voorbereiden</h1>
      <p className="text-cream/50 text-sm mb-8">
        Test-gegevens gericht wissen vóór je echt live gaat — per lijst te
        kiezen. Diensten &amp; prijzen, producten &amp; voorraad, en je
        klantenbestand kan je hier <span className="text-cream/80">nooit</span> wissen.
      </p>

      {!promptOpen ? (
        <button
          onClick={() => setPromptOpen(true)}
          className="text-xs px-4 py-2 rounded-full border border-hairline hover:border-gold transition"
        >
          Beginnen
        </button>
      ) : !unlocked ? (
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-cream/50 mb-1">Wachtwoord</label>
            <input
              type="password"
              autoFocus
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
              className="bg-panel border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <button
            onClick={unlock}
            disabled={unlockLoading || !unlockPassword}
            className="text-xs px-4 py-2 rounded-full bg-gold-gradient text-deep font-semibold h-fit disabled:opacity-40"
          >
            {unlockLoading ? "Bezig..." : "Bevestigen"}
          </button>
          <button
            onClick={() => setPromptOpen(false)}
            className="text-xs text-cream/30 hover:text-cream/50 h-fit py-2"
          >
            annuleren
          </button>
          {unlockError && <p className="text-red-400 text-xs">{unlockError}</p>}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-6">
            <p className="text-xs text-cream/40">
              Maak eerst een{" "}
              <a href="/api/backup" download className="text-gold-light underline">
                back-up (JSON)
              </a>{" "}
              als je die nog niet hebt — dit is niet ongedaan te maken.
            </p>
            <button onClick={lock} className="text-xs text-cream/40 hover:text-gold shrink-0 ml-4">
              Vergrendelen
            </button>
          </div>

          {result && (
            <div className="mb-6 px-4 py-3 rounded-xl border border-dashed border-hairline/60 bg-panel/10">
              <p className="text-sm text-gold-light mb-1">Verwijderd:</p>
              <ul className="text-xs text-cream/60 space-y-0.5">
                {Object.entries(result).map(([key, n]) => (
                  <li key={key}>
                    {LABELS[key] || key}: {n}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 mb-6">
            <button
              onClick={selectPreset}
              className="text-xs px-3 py-1.5 rounded-full border border-hairline hover:border-gold transition"
            >
              Agenda + financieel selecteren
            </button>
            <button
              onClick={selectNone}
              className="text-xs px-3 py-1.5 rounded-full border border-hairline hover:border-gold transition"
            >
              Niets selecteren
            </button>
          </div>

          <div className="space-y-8">
            {GROUPS.map((group) => (
              <div key={group.title}>
                <h2 className="font-display text-base text-gold mb-0.5">{group.title}</h2>
                <p className="text-[11px] text-cream/35 mb-3">{group.hint}</p>
                <ul className="space-y-2">
                  {group.items.map((item) => (
                    <li key={item.key}>
                      <label className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-hairline/60 hover:border-hairline cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selected.has(item.key)}
                          onChange={() => toggle(item.key)}
                          className="mt-0.5"
                        />
                        <span className="flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-sm text-cream/85">{item.label}</span>
                            <span className="text-xs text-cream/40 shrink-0">
                              {counts[item.key] ?? 0} item{(counts[item.key] ?? 0) === 1 ? "" : "s"}
                            </span>
                          </span>
                          {item.hint && (
                            <span className="block text-[11px] text-cream/35 mt-0.5">{item.hint}</span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-hairline/30">
            {!confirmOpen ? (
              <button
                disabled={selected.size === 0}
                onClick={() => setConfirmOpen(true)}
                className="text-xs px-4 py-2.5 rounded-full bg-red-500/90 hover:bg-red-500 text-white font-semibold transition disabled:opacity-30"
              >
                {selected.size === 0
                  ? "Kies eerst minstens één lijst"
                  : `${selected.size} geselecteerde lijst${selected.size === 1 ? "" : "en"} verwijderen`}
              </button>
            ) : (
              <div className="border border-red-500/40 rounded-xl p-4">
                <p className="text-sm text-cream/80 mb-1">
                  Je staat op het punt om definitief te verwijderen:
                </p>
                <ul className="text-xs text-cream/50 mb-4 list-disc list-inside">
                  {Array.from(selected).map((k) => (
                    <li key={k}>
                      {LABELS[k]} ({counts[k] ?? 0})
                    </li>
                  ))}
                </ul>

                <label className="block text-xs text-cream/50 mb-1.5">Wachtwoord</label>
                <input
                  type="password"
                  autoFocus
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm mb-5 focus:outline-none focus:border-gold"
                />

                <p className="text-sm text-cream/85 font-semibold mb-1">
                  Ben je zeker dat je dit wilt wissen?
                </p>
                <p className="text-xs text-cream/40 mb-4">
                  Dit kan niet ongedaan gemaakt worden.
                </p>

                {confirmError && <p className="text-red-400 text-xs mb-3">{confirmError}</p>}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setConfirmOpen(false);
                      setConfirmPassword("");
                      setConfirmError(null);
                    }}
                    className="flex-1 py-2.5 rounded-full border border-hairline hover:border-gold transition text-sm"
                  >
                    Nee, annuleren
                  </button>
                  <button
                    disabled={confirmLoading || !confirmPassword}
                    onClick={submitDelete}
                    className="flex-1 py-2.5 rounded-full bg-red-500/90 hover:bg-red-500 text-white font-semibold text-sm transition disabled:opacity-30"
                  >
                    {confirmLoading ? "Bezig..." : "Ja, verwijderen"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
