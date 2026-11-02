import { NextRequest, NextResponse } from "next/server";

/**
 * Forwards a portal request to the Laravel API with the admin_token cookie
 * as the bearer token. JSON and multipart bodies and the query string pass
 * through unchanged; the API's JSON and status come straight back.
 */
export async function forward(
  request: NextRequest,
  apiPath: string,
  { auth = true }: { auth?: boolean } = {}
) {
  const headers: Record<string, string> = { Accept: "application/json" };

  if (auth) {
    const token = request.cookies.get("admin_token")?.value;
    if (!token) {
      return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let body: BodyInit | undefined;
  if (request.method !== "GET") {
    if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      body = await request.formData();
    } else {
      body = await request.text();
      headers["Content-Type"] = "application/json";
    }
  }

  let apiResponse: Response;
  try {
    apiResponse = await fetch(`${process.env.API_URL}/api${apiPath}${request.nextUrl.search}`, {
      method: request.method,
      headers,
      body,
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
