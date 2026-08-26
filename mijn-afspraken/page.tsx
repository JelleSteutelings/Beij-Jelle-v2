import Link from "next/link";
import MyBookingsLookup from "./MyBookingsLookup";

export default function MijnAfsprakenPage() {
  return (
    <main className="min-h-screen">
      <div className="max-w-xl mx-auto px-6 py-10">
        <Link href="/" className="eyebrow hover:text-gold-light transition">
          &larr; Doeëg Mêin Haore
        </Link>
        <h1 className="font-display text-2xl sm:text-3xl mt-4 mb-2">
          Mijn afspraken
        </h1>
        <p className="text-sm text-cream/50 mb-8">
          Vul je e-mailadres in en we sturen je een overzicht van je
          eerstvolgende afspraken door.
        </p>
        <MyBookingsLookup />
      </div>
    </main>
  );
}
