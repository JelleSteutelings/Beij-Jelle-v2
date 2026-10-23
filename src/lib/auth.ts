import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getSessionSecret } from "./session-secret";

const COOKIE_NAME = "bj_admin_session";

export async function signSessionToken(): Promise<string> {
  const s = getSessionSecret();
  if (!s.ok) throw new Error(s.reason);
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(s.secret);
}

export async function verifySessionToken(token: string): Promise<boolean> {
  const s = getSessionSecret();
  if (!s.ok) return false;
  try {
    await jwtVerify(token, s.secret);
    return true;
  } catch {
    return false;
  }
}

export async function isAuthed(): Promise<boolean> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
