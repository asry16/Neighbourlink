import { prisma } from "@/lib/prisma";

export interface OfficialHazardDto {
  id: string;
  source: string;
  sourceUrl?: string | null;
  isDemo: boolean;
  hazardType: string;
  severity: string;
  headline: string;
  description: string;
  affectedArea: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  issuedAt: Date;
  expiresAt: Date;
  fetchedAt: Date;
  isStale: boolean;
}

export interface IHazardIngestionAdapter {
  fetchAlerts(): Promise<OfficialHazardDto[]>;
}

export class HazardService {
  /**
   * Fetch official hazard records with stale-data checks
   */
  static async getOfficialHazards(): Promise<OfficialHazardDto[]> {
    const records = await prisma.hazardUpdate.findMany({
      orderBy: { issuedAt: "desc" },
    });

    const now = new Date();

    return records.map((h) => {
      const isExpired = new Date(h.expiresAt) < now;
      const isFetchStale = now.getTime() - new Date(h.fetchedAt).getTime() > 24 * 3600 * 1000;
      const isStale = isExpired || isFetchStale;

      return {
        ...h,
        isStale,
      };
    });
  }

  /**
   * Create an official hazard bulletin (authorized admin only)
   */
  static async createOfficialHazard(data: {
    source: string;
    sourceUrl?: string;
    hazardType: string;
    severity: string;
    headline: string;
    description: string;
    affectedArea: string;
    centerLat: number;
    centerLng: number;
    radiusKm: number;
    issuedAt: Date;
    expiresAt: Date;
  }) {
    return prisma.hazardUpdate.create({
      data: {
        ...data,
        isDemo: false,
      },
    });
  }
}
