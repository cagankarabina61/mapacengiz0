// Segment kapı kuralı servisi (madde 5): kural PROJEDEN gelir, kodda sabit değildir.
import { prisma } from "@/lib/db";
import type { SegmentGateRuleConfig } from "@/lib/logic/segments";

/**
 * Yapıya özel kural varsa onu, yoksa proje geneli (structureId = null) kuralı döner.
 * Hiçbiri tanımlı değilse null → sistem kapı kararı üretmez, "Tanımlanmamış" der.
 */
export async function getSegmentGateRule(
  structureId: string | null
): Promise<SegmentGateRuleConfig | null> {
  const rules = await prisma.segmentGateRule.findMany({
    where: { OR: [{ structureId }, { structureId: null }] },
  });
  const specific = structureId ? rules.find((r) => r.structureId === structureId) : undefined;
  const fallback = rules.find((r) => r.structureId === null);
  const rule = specific ?? fallback;
  if (!rule) return null;
  return {
    requiredSteps: rule.requiredSteps,
    requireStrength: rule.requireStrength,
    asymmetryThreshold: rule.asymmetryThreshold,
    note: rule.note,
  };
}
