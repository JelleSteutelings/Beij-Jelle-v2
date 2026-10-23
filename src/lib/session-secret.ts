// Bepaalt de geheime sleutel waarmee admin-inlogsessies worden ondertekend.
// Bewust zonder Node-only imports, zodat dit ook in de middleware (edge) werkt.
//
// In productie is er GEEN terugvalsleutel meer: zonder een geldige
// SESSION_SECRET kan niemand inloggen (de app blijft draaien, maar het beheer
// blijft dicht). Zo kan een sleutel die in de broncode staat nooit gebruikt
// worden om een sessie na te maken.

const MIN_SECRET_LENGTH = 32;

// Waarden die we nooit accepteren: de oude terugvalsleutel uit de code en de
// voorbeeldwaarde uit .env.example.
const REJECTED_PREFIXES = [
  "beij-jelle-dev-secret",
  "verander-mij",
  "change-me",
  "changeme",
];

// Enkel voor lokaal ontwikkelen (npm run dev). Wordt in productie nooit gebruikt.
const DEV_ONLY_SECRET = "beij-jelle-LOKAAL-ontwikkelen-niet-voor-productie-0123456789";

let warned = false;

export type SecretStatus =
  | { ok: true; secret: Uint8Array }
  | { ok: false; reason: string };

export function getSessionSecret(): SecretStatus {
  const enc = new TextEncoder();
  const raw = (process.env.SESSION_SECRET || "").trim();

  if (raw) {
    const lower = raw.toLowerCase();
    const rejected = REJECTED_PREFIXES.some((p) => lower.startsWith(p));
    if (!rejected && raw.length >= MIN_SECRET_LENGTH) {
      return { ok: true, secret: enc.encode(raw) };
    }
  }

  if (process.env.NODE_ENV !== "production") {
    return { ok: true, secret: enc.encode(DEV_ONLY_SECRET) };
  }

  const reason = raw
    ? `SESSION_SECRET is te kort (minstens ${MIN_SECRET_LENGTH} tekens) of is een voorbeeldwaarde.`
    : "SESSION_SECRET is niet ingesteld.";
  if (!warned) {
    warned = true;
    console.error(
      `[beveiliging] ${reason} Inloggen in het beheer is geblokkeerd tot er een lange, willekeurige SESSION_SECRET is ingesteld.`
    );
  }
  return { ok: false, reason };
}
