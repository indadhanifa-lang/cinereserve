import { NextRequest } from "next/server";
import { forward } from "@/lib/api-proxy";

export const GET = (request: NextRequest) => forward(request, "/admin/branches");
export const POST = (request: NextRequest) => forward(request, "/admin/branches");
