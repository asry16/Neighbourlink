import { NextResponse } from "next/server";
import { HazardService } from "@/services/hazard-service";
import { prisma } from "@/lib/prisma";
import { authorize, type Role } from "@/authz/cedar";

export async function GET() {
  try {
    const hazards = await HazardService.getOfficialHazards();
    return NextResponse.json({ success: true, data: hazards });
  } catch (error: any) {
    console.error("GET /api/hazards failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch official hazards" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Official warnings outrank everything in the app; Cedar allows admins only.
    const author =
      typeof body.userId === "string"
        ? await prisma.user.findUnique({ where: { id: body.userId }, select: { role: true } })
        : null;
    const decision = authorize(
      { id: typeof body.userId === "string" ? body.userId : "anonymous", role: (author?.role ?? "GUEST") as Role },
      "PublishOfficialHazard",
      { type: "Platform" }
    );
    if (!decision.allowed) {
      return NextResponse.json(
        { success: false, error: "Only administrators can publish official hazard updates" },
        { status: 403 }
      );
    }
    delete body.userId;
    const hazard = await HazardService.createOfficialHazard({
      ...body,
      issuedAt: body.issuedAt ? new Date(body.issuedAt) : new Date(),
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + 86400000),
    });
    return NextResponse.json({ success: true, data: hazard }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create hazard update" },
      { status: 500 }
    );
  }
}
