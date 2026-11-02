import { NextRequest } from "next/server";
import { forward } from "@/lib/api-proxy";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forward(request, `/platform/branches/${encodeURIComponent(id)}/status`);
}
