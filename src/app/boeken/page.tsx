import Link from "next/link";
import BookingFlow from "./BookingFlow";

export default function BoekenPage() {
  return (
    <main className="min-h-screen">
      <div className="max-w-xl mx-auto px-6 py-10">
        <Link href="/" className="eyebrow hover:text-gold-light transition">
          &larr; Doeëg Mêin Haore
        </Link>
        <h1 className="font-display text-2xl sm:text-3xl mt-4 mb-8">
          Boek je afspraak
        </h1>
        <BookingFlow />
      </div>
    </main>
  );
}
