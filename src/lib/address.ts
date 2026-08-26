export type AddressParts = {
  street: string; // straat + huisnummer
  postalCode: string;
  city: string;
};

/**
 * Voegt de losse velden samen tot één bewaarbare adresstring, bv.
 * "Kerkstraat 12, 3650 Stokkem".
 */
export function combineAddress(parts: AddressParts): string {
  const street = parts.street.trim();
  const postalCode = parts.postalCode.trim();
  const city = parts.city.trim();
  const line2 = [postalCode, city].filter(Boolean).join(" ");
  return [street, line2].filter(Boolean).join(", ");
}

/**
 * Best-effort: haalt straat/postcode/gemeente terug uit een eerder
 * opgeslagen adresstring, zodat bestaande adressen ook in de losse
 * velden getoond kunnen worden om te bewerken. Lukt het splitsen niet
 * (bv. een heel oud, vrij ingetypt adres), dan komt alles in "straat"
 * te staan en blijven postcode/gemeente leeg — nog steeds correct te
 * corrigeren door de gebruiker.
 */
export function parseAddress(address: string | undefined): AddressParts {
  if (!address) return { street: "", postalCode: "", city: "" };

  const parts = address.split(",");
  if (parts.length < 2) {
    return { street: address.trim(), postalCode: "", city: "" };
  }

  const street = parts[0].trim();
  const rest = parts.slice(1).join(",").trim();
  const match = rest.match(/^(\d{4,6})\s*(.*)$/);
  if (match) {
    return { street, postalCode: match[1], city: match[2].trim() };
  }
  return { street, postalCode: "", city: rest };
}
