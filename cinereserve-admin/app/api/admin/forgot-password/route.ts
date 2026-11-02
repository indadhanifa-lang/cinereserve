import { NextRequest } from "next/server";
import { forward } from "@/lib/api-proxy";

export const POST = (request: NextRequest) =>
  forward(request, "/admin/forgot-password", { auth: false });
