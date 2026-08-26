// Vast, herkenbaar kleurenpalet voor afspraken in de agenda. Elke afspraak
// krijgt altijd dezelfde kleur (afgeleid van haar id), zodat meerdere
// "bezette" blokken van dezelfde klant duidelijk bij elkaar horen.
const PALETTE = [
  "#e0a83f", // goud
  "#5fb3d9", // hemelsblauw
  "#d97ba0", // roze
  "#8fd48f", // salie
  "#c99bf0", // lavendel
  "#f0b35c", // amber
  "#7fd4c1", // teal
  "#f08a7f", // koraal
];

export function bookingColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
