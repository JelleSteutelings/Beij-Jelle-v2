"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "beijJelleTheme";

export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggle() {
    const next = !isLight;
    setIsLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "light" : "dark");
    } catch {
      // localStorage niet beschikbaar — voorkeur wordt dan gewoon niet onthouden
    }
  }

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-hairline hover:border-gold text-cream/60 hover:text-gold transition"
      title={isLight ? "Naar donker thema" : "Naar licht thema"}
    >
      <span>{isLight ? "☀️" : "🌙"}</span>
      <span>{isLight ? "Licht" : "Donker"}</span>
    </button>
  );
}
