"use client";

import { useState } from "react";

export default function MyBookingsLookup() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/my-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Er ging iets mis. Probeer opnieuw.");
        return;
      }
      setSent(true);
    } catch {
      setError("Kon geen verbinding maken. Probeer het later opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!sent ? (
        <>
          <div className="mb-2">
            <label className="block text-xs text-cream/50 mb-1.5">
              E-mailadres
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="jouw@email.be"
              className="w-full bg-panel border border-hairline rounded-lg px-4 py-2.5 focus:outline-none focus:border-gold"
            />
          </div>
          <p className="text-xs text-cream/40 mb-6">
            Gebruik het e-mailadres dat je bij het boeken hebt opgegeven. We
            versturen je afspraken enkel per mail, zodat niemand anders ze
            zomaar kan opvragen.
          </p>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <button
            onClick={handleSend}
            disabled={!email.trim() || loading}
            className={`w-full py-3 rounded-full bg-gold-gradient text-deep font-semibold transition ${
              loading ? "opacity-70 cursor-wait" : "disabled:opacity-30"
            }`}
          >
            {loading ? "Bezig met versturen..." : "Stuur mijn afspraken door"}
          </button>
        </>
      ) : (
        <div className="text-center py-6">
          <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-gold-gradient flex items-center justify-center text-deep text-2xl">
            ✓
          </div>
          <h2 className="font-display text-xl mb-2">E-mail onderweg</h2>
          <p className="text-cream/60 text-sm max-w-xs mx-auto">
            Staat dit e-mailadres bij ons gekend en heb je nog aankomende
            afspraken, dan ontvang je binnen enkele minuten een overzicht in
            je mailbox.
          </p>
        </div>
      )}

      <a
        href="/"
        className="block w-full text-center border border-gold text-gold px-6 py-3 rounded-full hover:bg-panel transition font-semibold mt-8"
      >
        Terug naar home
      </a>
    </div>
  );
}
