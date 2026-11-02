import { NextRequest } from "next/server";
import { forward } from "@/lib/api-proxy";

type Context = { params: Promise<{ id: string }> };

async function handle(request: NextRequest, { params }: Context) {
  const { id } = await params;
  return forward(request, `/screens/${encodeURIComponent(id)}/photos`);
}

export { handle as POST, handle as DELETE };
