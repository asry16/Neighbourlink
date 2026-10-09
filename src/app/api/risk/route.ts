import { NextResponse } from "next/server";
import { RiskService } from "@/services/risk-service";

export async function GET() {
  try {
    const estimates = await RiskService.getStoredEstimates();
    return NextResponse.json({ success: true, data: estimates });
  } catch (error: any) {
    console.error("GET /api/risk failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch risk estimates" },
      { status: 500 }
    );
  }
}
