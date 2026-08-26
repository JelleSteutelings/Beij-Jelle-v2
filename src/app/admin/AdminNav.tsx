"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUnsavedChanges } from "./UnsavedChangesContext";
import { useLayoutMode } from "./LayoutModeContext";

const LINKS = [
  { href: "/admin/agenda", label: "Agenda" },
  { href: "/admin/klanten", label: "Klanten" },
  { href: "/admin/voorraad", label: "Voorraad" },
  { href: "/admin/cadeaubonnen", label: "Cadeaubonnen" },
  { href: "/admin/snelle-verkoop", label: "Snelle verkoop" },
  { href: "/admin/cash", label: "Cash" },
  { href: "/admin/dashboards", label: "Dashboards" },
  { href: "/admin/instellingen", label: "Instellingen" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { confirmDiscard, setDirty } = useUnsavedChanges();
  const { hideNav } = useLayoutMode();

  if (pathname === "/admin/login") return null;
  if (hideNav) return null;

  function handleNavClick(e: React.MouseEvent, href: string) {
    if (pathname === href) return;
    if (!confirmDiscard()) {
      e.preventDefault();
      return;
    }
    setDirty(false);
  }

  async function logout() {
    if (!confirmDiscard()) return;
    setDirty(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/boeken");
    router.refresh();
  }

  return (
    <nav className="sm:w-56 shrink-0 border-b sm:border-b-0 sm:border-r border-hairline bg-panel/40">
      <div className="px-6 py-6 flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-6">
        <Link
          href="/admin/agenda"
          className="flex items-center gap-2"
          onClick={(e) => handleNavClick(e, "/admin/agenda")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-primair.png" alt="" className="w-9 h-9 object-contain" />
          <span className="font-display text-sm">Bêij Jelle</span>
        </Link>
        <div className="hidden sm:block h-px bg-hairline w-full" />
        <ul className="flex sm:flex-col gap-1 sm:gap-1 sm:w-full text-sm">
          {LINKS.map((l) => (
            <li key={l.href} className="sm:w-full">
              <Link
                href={l.href}
                onClick={(e) => handleNavClick(e, l.href)}
                className={`block px-3 py-2 rounded-lg transition ${
                  pathname?.startsWith(l.href)
                    ? "bg-gold-gradient text-deep font-semibold"
                    : "text-cream/70 hover:bg-panel hover:text-cream"
                }`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="px-6 pb-6 hidden sm:block">
        <button
          onClick={logout}
          className="text-xs text-cream/40 hover:text-gold transition"
        >
          Uitloggen
        </button>
      </div>
    </nav>
  );
}
