import { NextRequest, NextResponse } from "next/server";

const ADMIN_USER = process.env.ADMIN_USER ?? "spmlr";
const ADMIN_PASS = process.env.ADMIN_PASSWORD ?? "spmlr102!!";
const SESSION_TOKEN = process.env.SESSION_TOKEN ?? "deepnews-local-dev-token";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return NextResponse.json(
      { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("dn_auth", SESSION_TOKEN, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7일
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("dn_auth", "", { maxAge: 0, path: "/" });
  return res;
}
