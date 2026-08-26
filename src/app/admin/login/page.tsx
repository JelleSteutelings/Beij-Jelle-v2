"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const rawText = await res.text();
      let data: { error?: string } = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        // rawText wasn't JSON — we'll show it raw below for debugging
      }

      if (res.ok) {
        router.push("/admin/agenda");
        router.refresh();
      } else {
        setError(
          data.error ||
            `Inloggen mislukt (status ${res.status}). Server zei: ${
              rawText ? rawText.slice(0, 200) : "(leeg antwoord)"
            }`
        );
        setLoading(false);
      }
    } catch (err) {
      setError(
        `Kon de server niet bereiken: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-panel border border-hairline rounded-2xl p-8"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-primair.png" alt="Bêij Jelle" className="w-24 mx-auto mb-6" />
        <h1 className="font-display text-xl text-center mb-1">Beheer</h1>
        <p className="text-cream/40 text-xs text-center mb-6">
          Doeëg Mêin Haore
        </p>
        <label className="block text-xs text-cream/50 mb-1.5">Wachtwoord</label>
        <div className="relative mb-4">
          <input
            type={showPassword ? "text" : "password"}
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-deep border border-hairline rounded-lg px-4 py-2.5 pr-16 focus:outline-none focus:border-gold"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cream/40 hover:text-gold"
          >
            {showPassword ? "verberg" : "toon"}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-gold-gradient text-deep font-semibold py-2.5 rounded-full hover:brightness-110 transition disabled:opacity-50"
        >
          {loading ? "Bezig..." : "Inloggen"}
        </button>
      </form>
    </main>
  );
}
