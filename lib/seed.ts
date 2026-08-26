import { readDB, writeDB } from "./db";
import { Service } from "./types";

// Prijslijst Doeëg Mêin Haore. Duurtijden zijn een inschatting (aanpasbaar
// via Instellingen in de admin) omdat deze niet expliciet werden opgegeven.
const SERVICES: Omit<Service, "id" | "active">[] = [
  // Knippen & brushing
  { category: "Knippen & brushing", name: "Brushing kort", price: 25, durationMinutes: 30 },
  { category: "Knippen & brushing", name: "Brushing lang", price: 30, durationMinutes: 45 },
  { category: "Knippen & brushing", name: "Snit kort", price: 40, durationMinutes: 45 },
  { category: "Knippen & brushing", name: "Snit lang", price: 45, durationMinutes: 60 },
  { category: "Knippen & brushing", name: "Heren snit", price: 22, durationMinutes: 30 },
  { category: "Knippen & brushing", name: "Tondeuze", price: 19, durationMinutes: 20 },
  { category: "Knippen & brushing", name: "Baard", price: 20, durationMinutes: 15 },

  // Kleuring
  { category: "Kleuring", name: "Kleuring kort", price: 60, durationMinutes: 60 },
  { category: "Kleuring", name: "Kleuring lang", price: 67, durationMinutes: 75 },
  { category: "Kleuring", name: "Kleuring + snit kort", price: 67, durationMinutes: 90 },
  { category: "Kleuring", name: "Kleuring + snit lang", price: 72, durationMinutes: 105 },
  { category: "Kleuring", name: "Kleuring + snit + brushing kort", price: 77, durationMinutes: 120 },
  { category: "Kleuring", name: "Kleuring + snit + brushing lang", price: 82, durationMinutes: 135 },
  { category: "Kleuring", name: "Kleur + lokken", price: 82, durationMinutes: 120 },

  // Balayage
  { category: "Balayage", name: "Halve balayage een kleur", price: 78, durationMinutes: 120 },
  { category: "Balayage", name: "Halve balayage twee kleuren", price: 83, durationMinutes: 135 },
  { category: "Balayage", name: "Volledige balayage een kleur", price: 95, durationMinutes: 150 },
  { category: "Balayage", name: "Volledige balayage twee kleuren", price: 100, durationMinutes: 165 },

  // Ontkleuring
  { category: "Ontkleuring", name: "Ontkleuring kort", price: 60, durationMinutes: 90 },
  { category: "Ontkleuring", name: "Ontkleuring lang", price: 65, durationMinutes: 105 },

  // Permanent
  { category: "Permanent", name: "Permanent kort", price: 58, durationMinutes: 90 },
  { category: "Permanent", name: "Permanent lang", price: 63, durationMinutes: 105 },

  // Toner
  { category: "Toner", name: "Toner kort", price: 47, durationMinutes: 45 },
  { category: "Toner", name: "Toner lang", price: 57, durationMinutes: 60 },

  // Kinderen
  { category: "Kinderen", name: "Kindersnit t.e.m. 3j", price: 10, durationMinutes: 20 },
  { category: "Kinderen", name: "Jongens 3j t.e.m. 12j", price: 15, durationMinutes: 30 },
  { category: "Kinderen", name: "Meisjes 3j t.e.m. 12j", price: 20, durationMinutes: 40 },
];

const SAMPLE_PRODUCTS = [
  { name: "Kiss Shampoo (1L)", stock: 8, minStock: 2, unit: "flessen" },
  { name: "Kiss Conditioner (1L)", stock: 6, minStock: 2, unit: "flessen" },
  { name: "Kiss Styling gel", stock: 5, minStock: 2, unit: "stuks" },
  { name: "Kiss Haarlak", stock: 5, minStock: 2, unit: "spuitbussen" },
  { name: "Muran kleuring (tube)", stock: 10, minStock: 3, unit: "tubes" },
  { name: "Muran blondeerpoeder", stock: 5, minStock: 2, unit: "zakjes" },
  { name: "Muran ontwikkelaar 20 vol", stock: 4, minStock: 1, unit: "flessen" },
  { name: "Muran ontwikkelaar 30 vol", stock: 3, minStock: 1, unit: "flessen" },
  { name: "Folie balayage", stock: 3, minStock: 1, unit: "rollen" },
];

export function seedIfEmpty() {
  const db = readDB();
  let changed = false;

  if (db.services.length === 0) {
    db.services = SERVICES.map((s, i) => ({
      ...s,
      id: `svc_${i + 1}`,
      active: true,
    }));
    changed = true;
  }

  if (db.products.length === 0) {
    db.products = SAMPLE_PRODUCTS.map((p, i) => ({ ...p, id: `prod_${i + 1}` }));
    changed = true;
  }

  if (changed) writeDB(db);
  return db;
}
