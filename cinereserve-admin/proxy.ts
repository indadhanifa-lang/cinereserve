import { NextRequest, NextResponse } from "next/server";

const TOKEN_PATTERN = /^\d+\|[A-Za-z0-9]{35,}$/;

export function proxy(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;

  if (!token || !TOKEN_PATTERN.test(token)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
