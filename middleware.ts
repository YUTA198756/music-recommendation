import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get("uid")) {
    res.cookies.set("uid", crypto.randomUUID(), {
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api).*)"],
};
