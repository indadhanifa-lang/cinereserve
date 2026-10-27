import { NextRequest, NextResponse } from "next/server";

/** Multipart update (poster upload), forwarded as POST because PHP does
 * not parse multipart PUT/PATCH bodies. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("admin_token")?.value;
  if (!token) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ message: "No form data provided." }, { status: 400 });
  }

  let apiResponse: Response;
  try {
    apiResponse = await fetch(
      `${process.env.API_URL}/api/admin/movies/${encodeURIComponent(id)}`,
      {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        body: formData,
      }
    );
  } catch {
    return NextResponse.json(
      { message: "Unable to reach the server. Try again." },
      { status: 502 }
    );
  }

  const data = await apiResponse.json().catch(() => ({}));
  return NextResponse.json(data, { status: apiResponse.status });
}
