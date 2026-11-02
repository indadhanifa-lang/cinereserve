import { NextRequest } from "next/server";
import { forward } from "@/lib/api-proxy";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forward(request, `/admin/branches/${encodeURIComponent(id)}/select`);
}
