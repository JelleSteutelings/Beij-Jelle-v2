import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "bj_admin_session";
const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "beij-jelle-dev-secret-change-me"
);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    let valid = false;
    if (token) {
      try {
        await jwtVerify(token, SECRET);
        valid = true;
      } catch {
        valid = false;
      }
    }
    if (!valid) {
      const loginUrl = new URL("/admin/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
