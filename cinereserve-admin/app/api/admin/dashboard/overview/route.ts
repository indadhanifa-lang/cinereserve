import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;
  if (!token) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  let apiResponse: Response;
  try {
    apiResponse = await fetch(`${process.env.API_URL}/api/admin/dashboard/overview`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
  } catch {
    return NextResponse.json(
      { message: "Unable to reach the server. Try again." },
      { status: 502 }
    );
  }

  const data = await apiResponse.json().catch(() => ({}));
  return NextResponse.json(data, { status: apiResponse.status });
}
