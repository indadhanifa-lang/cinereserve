import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  let apiResponse: Response;
  try {
    apiResponse = await fetch(`${process.env.API_URL}/api/admin/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json(
      { message: "Unable to reach the server. Try again." },
      { status: 502 }
    );
  }

  const data = await apiResponse.json().catch(() => ({}));

  if (!apiResponse.ok) {
    return NextResponse.json(data, { status: apiResponse.status });
  }

  // Signup signs the new admin straight in, same cookie as /api/admin/login.
  const response = NextResponse.json({ ok: true, user: data.user }, { status: 201 });
  response.cookies.set("admin_token", data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
