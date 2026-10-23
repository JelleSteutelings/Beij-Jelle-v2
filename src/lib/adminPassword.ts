import bcrypt from "bcryptjs";
import crypto from "crypto";

// Enkel bruikbaar tijdens lokaal ontwikkelen (npm run dev). In productie wordt
// dit wachtwoord altijd geweigerd, ook als het toevallig nog in een oude
// database staat.
export const DEV_DEFAULT_PASSWORD = "jelle2026";
export const MIN_PASSWORD_LENGTH = 10;

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Valideert een nieuw wachtwoord; geeft een foutmelding of null. */
export function validateNewPassword(pw: unknown): string | null {
  if (typeof pw !== "string" || pw.length < MIN_PASSWORD_LENGTH) {
    return `Wachtwoord moet minstens ${MIN_PASSWORD_LENGTH} tekens hebben.`;
  }
  if (pw === DEV_DEFAULT_PASSWORD) {
    return "Kies een ander wachtwoord dan het oude standaardwachtwoord.";
  }
  return null;
}

/**
 * Controleert het beheerderswachtwoord tegen de opgeslagen hash. In productie
 * wordt het oude standaardwachtwoord nooit meer aanvaard.
 */
export function verifyAdminPassword(password: unknown, hash: string | undefined): boolean {
  if (typeof password !== "string" || !password || !hash) return false;
  if (isProduction() && password === DEV_DEFAULT_PASSWORD) return false;
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

/**
 * Staat er in productie nog géén bruikbaar wachtwoord (lege hash, of nog de
 * hash van het oude standaardwachtwoord uit een oudere versie)?
 */
export function needsInitialPassword(hash: string | undefined): boolean {
  if (!hash) return true;
  if (!isProduction()) return false;
  try {
    return bcrypt.compareSync(DEV_DEFAULT_PASSWORD, hash);
  } catch {
    return true;
  }
}

/** Het opstartwachtwoord uit de omgevingsvariabele ADMIN_INITIAL_PASSWORD, indien geldig. */
export function getInitialPassword(): string | null {
  const pw = process.env.ADMIN_INITIAL_PASSWORD;
  if (!pw) return null;
  return validateNewPassword(pw) ? null : pw;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
