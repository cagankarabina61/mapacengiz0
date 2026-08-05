// Birleşik "neden bloke / ne yapılırsa hazır olur" servisi (madde 11).
// NCR etkisi, çizim readiness ve kazık kabulü de dahil (madde 7/8/9).
import { prisma } from "@/lib/db";
import { getActivityReadiness } from "@/lib/services/readiness";
import type { BlockingReason } from "@/lib/logic/blocking";

/** Bir aktivitenin tüm bloke sebepleri. */
export async function getActivityBlockingReasons(activityId: string): Promise<BlockingReason[]> {
  const readiness = await getActivityReadiness(activityId);
  return readiness.reasons;
}

export interface BlockedActivityView {
  activity: {
    id: string;
    name: string;
    status: string;
    plannedStart: Date | null;
    plannedEnd: Date | null;
    element: { name: string; code: string; structure: { code: string } };
    responsibleUser: { name: string } | null;
    crewResource: { name: string } | null;
  };
  reasons: BlockingReason[];
  nextActions: string[];
  summary: string;
  canStart: boolean;
}

/**
 * Bloke veya uyarılı aktiviteleri sebepleriyle listeler.
 * Aday kümesi geniş tutulur (RFI/HoldPoint/öncül/NCR/çizim) ve readiness servisiyle doğrulanır.
 */
export async function getBlockedActivities(structureId?: string): Promise<BlockedActivityView[]> {
  const candidates = await prisma.activity.findMany({
    where: {
      status: { notIn: ["TAMAMLANDI", "IPTAL"] },
      ...(structureId ? { element: { structureId } } : {}),
    },
    include: {
      element: { include: { structure: true } },
      responsibleUser: true,
      crewResource: true,
    },
    orderBy: { plannedStart: "asc" },
    take: 200,
  });

  const results: BlockedActivityView[] = [];
  for (const a of candidates) {
    const readiness = await getActivityReadiness(a.id);
    if (readiness.reasons.length === 0) continue;
    results.push({
      activity: a,
      reasons: readiness.reasons,
      nextActions: readiness.nextActions,
      summary: readiness.summary,
      canStart: readiness.canStart,
    });
  }
  // Gerçek blokajlar önce
  return results.sort((a, b) => Number(a.canStart) - Number(b.canStart));
}
