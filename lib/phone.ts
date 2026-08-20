/**
 * Normaliseert een telefoonnummer zodat verschillende schrijfwijzen van
 * hetzelfde nummer altijd als identiek herkend worden, bv.:
 *   "+32 499 12 34 56", "0032499123456", "0499 12 34 56", "0499-123456"
 * worden allemaal "+32499123456".
 *
 * Aanname: Belgische nummers (landcode 32). Internationale nummers die al
 * met + beginnen en niet met 32, blijven ongewijzigd (enkel opgeschoond).
 */
export function normalizePhone(raw: string): string {
  if (!raw) return "";

  // Alles weghalen behalve cijfers en een eventuele voorloop-plus.
  let cleaned = raw.trim().replace(/[^\d+]/g, "");

  if (cleaned.startsWith("+")) {
    cleaned = "+" + cleaned.slice(1).replace(/\+/g, "");
  } else {
    cleaned = cleaned.replace(/\+/g, "");
  }

  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  } else if (cleaned.startsWith("+")) {
    // al internationaal formaat
  } else if (cleaned.startsWith("0")) {
    cleaned = "+32" + cleaned.slice(1);
  } else if (cleaned.startsWith("32")) {
    cleaned = "+" + cleaned;
  }

  return cleaned;
}

export type PhoneFormatResult =
  | { ok: true; formatted: string }
  | { ok: false; error: string };

/**
 * Zet het lokale deel van een Belgisch nummer (zonder +32, dus wat de
 * gebruiker typt naast de vaste "+32"-prefix) om naar één vast,
 * consistent formaat: "+32 4XX XX XX XX". Zo ziet elk nummer er in de
 * hele app en de database exact hetzelfde uit, ongeacht wie het invulde.
 *
 * Geeft een duidelijke foutmelding terug als het aantal cijfers niet
 * klopt voor een Belgisch mobiel nummer (9 cijfers na de landcode).
 */
export function formatBelgianPhone(local: string): PhoneFormatResult {
  const digits = local.trim().replace(/\D/g, "").replace(/^0+/, "");

  if (digits.length === 0) {
    return { ok: false, error: "Vul een GSM-nummer in." };
  }
  if (digits.length !== 9) {
    return {
      ok: false,
      error: `Een Belgisch GSM-nummer heeft 9 cijfers na +32 (bv. 499 12 34 56) — dit zijn er ${digits.length}.`,
    };
  }

  const formatted = `+32 ${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
  return { ok: true, formatted };
}
