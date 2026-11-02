import { NextRequest } from "next/server";
import { forward } from "@/lib/api-proxy";

export const GET = (request: NextRequest) => forward(request, "/admin/reports");
