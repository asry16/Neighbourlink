import { NextResponse } from "next/server";
import { RiskService } from "@/services/risk-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = RiskService.evaluateInputs(body);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to evaluate flood risk" },
      { status: 500 }
    );
  }
}
