import { NextRequest, NextResponse } from "next/server";
import { GET as handler } from "@/app/auth/callback/route";

export async function GET(request: NextRequest) {
  return handler(request);
}
