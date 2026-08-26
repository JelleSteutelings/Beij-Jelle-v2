import Link from "next/link";
import { readDB } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";
import PriceListAccordion from "./PriceListAccordion";
import ThemeToggle from "./ThemeToggle";

export const dynamic = "force-dynamic";

export default function HomePage() {
  seedIfEmpty();
  const db = readDB();
  const { settings, services } = db;

  const grouped: Record<string, typeof services> = {};
  for (const s of services.filter((s) => s.active)) {
    grouped[s.category] = grouped[s.category] || [];
    grouped[s.category].push(s);
  }

  return (
    <main>
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-hairline">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(224,168,63,0.10),transparent_60%)]" />
        <div className="relative max-w-3xl mx-auto px-6 pt-14 pb-16 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-secundair.png"
            alt="Bêij Jelle - Doeëg Mêin Haore"
            className="w-full max-w-md mb-8 drop-shadow-[0_0_24px_rgba(224,168,63,0.15)]"
          />
          <p className="eyebrow mb-3">Kapsalon in Stokkem</p>
          <h1 className="font-display text-3xl sm:text-4xl leading-snug text-balance mb-4">
            Doeëg Mêin Haore, <span className="text-gold">Bêij Jelle</span>
          </h1>
          <p className="text-cream/70 max-w-md mb-9 leading-relaxed">
            Knippen, kleuren, balayage en meer &mdash; boek je moment bij Doeëg
            Mêin Haore in enkele tikken.
          </p>
          <Link
            href="/boeken"
            className="inline-flex items-center gap-2 bg-gold-gradient text-deep font-semibold px-8 py-3.5 rounded-full tracking-wide hover:brightness-110 transition"
          >
            Boek een afspraak
          </Link>
          <Link
            href="/mijn-afspraken"
            className="mt-5 text-base text-cream/80 hover:text-gold-light transition underline underline-offset-4"
          >
            Al een afspraak? Vraag je afspraken per mail op
          </Link>
        </div>
      </section>

      {/* SFEERFOTO */}
      <section className="max-w-lg mx-auto px-6 pt-14">
        <div className="relative rounded-2xl overflow-hidden border border-hairline shadow-[0_0_40px_rgba(224,168,63,0.08)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/salon-foto.png"
            alt="Jelle aan het werk in de salon"
            className="w-full h-auto object-cover"
          />
        </div>
      </section>

      {/* PRIJSLIJST */}
      <section className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <p className="eyebrow mb-2">Prijslijst</p>
          <h2 className="font-display text-2xl">Diensten &amp; tarieven</h2>
        </div>

        <div className="space-y-10">
          <PriceListAccordion grouped={grouped} />
        </div>

        <p className="text-xs text-cream/40 mt-8 text-center">
          Studentenkaart = &minus;10%. (Speciale balayage-techniek: +&euro;5)
        </p>
      </section>

      <div className="snip-divider max-w-md" />

      {/* WERKDAGEN + CONTACT */}
      <section className="max-w-2xl mx-auto px-6 py-16 grid sm:grid-cols-2 gap-12">
        <div>
          <p className="eyebrow mb-2">Wanneer</p>
          <h2 className="font-display text-xl mb-5">Werkdagen</h2>
          <p className="text-sm text-cream/80 leading-relaxed">
            Jelle werkt op maandagnamiddag, woensdag, donderdag, vrijdag en
            zaterdag &mdash; en past de uren graag aan jouw agenda aan. Past
            geen enkel voorgesteld moment? Vraag het gewoon aan bij het
            boeken.
          </p>
        </div>

        <div>
          <p className="eyebrow mb-2">Contact &amp; locatie</p>
          <h2 className="font-display text-xl mb-5">Kom langs</h2>
          <address className="not-italic text-sm text-cream/80 leading-relaxed space-y-3">
            <p>
              {settings.address}
              <br />
              {settings.postalCity}
            </p>
            <p>
              <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="text-gold hover:underline">
                {settings.phone}
              </a>
            </p>
            <p className="flex gap-4 pt-1">
              <a
                href="https://www.facebook.com"
                target="_blank"
                rel="noreferrer"
                className="text-cream/70 hover:text-gold transition"
              >
                Facebook
              </a>
              <a
                href="https://www.instagram.com"
                target="_blank"
                rel="noreferrer"
                className="text-cream/70 hover:text-gold transition"
              >
                Instagram
              </a>
            </p>
          </address>
        </div>
      </section>

      <footer className="text-center text-xs text-cream/30 py-10 border-t border-hairline">
        <p>
          © {new Date().getFullYear()} {settings.businessName} · {settings.ownerName}
        </p>
        <Link
          href="/admin"
          className="inline-block mt-2 text-cream/15 hover:text-cream/40 transition text-[11px]"
        >
          Beheer
        </Link>
      </footer>
    </main>
  );
}
