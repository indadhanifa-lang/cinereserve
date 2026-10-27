import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;

  if (token) {
    try {
      await fetch(`${process.env.API_URL}/api/admin/logout`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
    } catch {
      // Best-effort — clear the local cookie regardless of API reachability.
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete("admin_token");
  return response;
}
