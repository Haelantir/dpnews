import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin/login") return NextResponse.next();

  const session = req.cookies.get("dn_auth")?.value;
  const token = process.env.SESSION_TOKEN ?? "deepnews-local-dev-token";

  if (!session || session !== token) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
