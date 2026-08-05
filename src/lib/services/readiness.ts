// Merkezi readiness servisi: "hangi iş hazır değil, neden, ne yapılırsa hazır olur" (madde 11).
// Aktivite ve beton dökümü için bağımlılık + hazırlık kapısı sonuçlarını tek yerde birleştirir.
import { prisma } from "@/lib/db";
import {
  rfiBlockingReasons,
  holdPointBlockingReasons,
  predecessorBlockingReasons,
  ncrBlockingReasons,
  drawingBlockingReasons,
  pileAcceptanceBlockingReasons,
  type BlockingReason,
  type DrawingStateRef,
} from "@/lib/logic/blocking";
import { computeWorkState, type WorkStateResult } from "@/lib/logic/workstate";
import { evaluatePourReadiness } from "@/lib/logic/readiness";

/** Bir yapı elemanının çizim durumu — onaylı revizyon ve sahadaki nüsha (madde 8). */
export async function getDrawingStates(elementId: string): Promise<DrawingStateRef[]> {
  const drawings = await prisma.drawing.findMany({
    where: { elementId },
    include: {
      revisions: true,
      usages: { where: { elementId }, include: { siteUsedRevision: true } },
    },
  });
  return drawings.map((d) => {
    const approved = d.revisions.find((r) => r.status === "ONAYLI");
    const usage = d.usages[0];
    return {
      drawingCode: d.code,
      approvedRevisionCode: approved?.revisionCode ?? null,
      siteUsedRevisionCode: usage?.siteUsedRevision.revisionCode ?? null,
    };
  });
}

/** Elemana ve üst elemanına bağlı açık NCR'lar (etki seviyeleriyle). */
async function getElementNCRs(elementId: string, parentId: string | null) {
  const ids = parentId ? [elementId, parentId] : [elementId];
  const ncrs = await prisma.nCR.findMany({
    where: { elementId: { in: ids }, status: { not: "KAPATILDI" } },
  });
  return ncrs.map((n) => ({ ncrNumber: n.ncrNumber, status: n.status, impact: n.impact }));
}

/**
 * Kazık kabul durumu (madde 9): pier altındaki kazık grubunun kabul sayısı.
 * Yalnızca şablonda `requiresPileAcceptance` işaretli aktivite için ön koşul üretir —
 * "tüm kazıklar kabul edildi" tek başına "pier hazır" anlamına GELMEZ.
 */
async function getPileAcceptance(elementId: string, parentId: string | null, required: boolean) {
  if (!required) return null;
  // Kazık grubu pier'e bağlıdır; pile cap gibi alt elemanlar için üst elemana bakılır.
  const ownerIds = parentId ? [elementId, parentId] : [elementId];
  const groups = await prisma.pileGroup.findMany({
    where: { elementId: { in: ownerIds } },
    include: { piles: true },
  });
  const piles = groups.flatMap((g) => g.piles);
  if (piles.length === 0) return null; // kazık tanımlı değil → varsayım yapma
  return {
    totalPiles: piles.length,
    acceptedPiles: piles.filter((p) => p.acceptanceStatus === "KABUL").length,
    required: true,
  };
}

export interface ActivityReadiness extends WorkStateResult {
  activityId: string;
}

/** Bir aktivitenin tüm bloke sebepleri + hazırlık durumu (madde 6/7/8/9). */
export async function getActivityReadiness(activityId: string): Promise<ActivityReadiness> {
  const activity = await prisma.activity.findUniqueOrThrow({
    where: { id: activityId },
    include: {
      element: true,
      rfiLinks: { include: { rfi: true } },
      predecessors: { include: { predecessor: true } },
      inspections: { include: { checkpoint: true } },
    },
  });

  // Şablonda bu adım kazık kabulünü şart koşuyor mu?
  const templateStep = await prisma.activityTemplateStep.findFirst({
    where: {
      activityType: activity.activityType,
      template: { elementType: activity.element.elementType },
    },
  });
  const requiresPiles = templateStep?.requiresPileAcceptance ?? false;

  const [drawingStates, ncrs, pileRef] = await Promise.all([
    getDrawingStates(activity.elementId),
    getElementNCRs(activity.elementId, activity.element.parentId),
    getPileAcceptance(activity.elementId, activity.element.parentId, requiresPiles),
  ]);

  const reasons: BlockingReason[] = [
    ...rfiBlockingReasons(
      activity.rfiLinks.map((l) => ({ rfiNumber: l.rfi.rfiNumber, status: l.rfi.status }))
    ),
    ...holdPointBlockingReasons(
      activity.inspections
        .filter((i) => i.checkpoint.checkpointType === "HOLD_POINT")
        .map((i) => ({ checkpointName: i.checkpoint.name, result: i.result }))
    ),
    ...predecessorBlockingReasons(
      activity.predecessors.map((d) => ({
        name: d.predecessor.name,
        status: d.predecessor.status,
      }))
    ),
    ...ncrBlockingReasons(ncrs),
    ...drawingBlockingReasons(drawingStates),
    ...pileAcceptanceBlockingReasons(pileRef),
  ];

  // Aktivite için ayrı bir hazırlık kontrol listesi tablosu yok; hazırlık kapısı
  // beton dökümüne özgüdür. Bu nedenle aktivitede kapı "tanımsız" olarak işaretlenir
  // ve sistem "İmalata Hazır" iddiasında bulunmaz (madde 49).
  const state = computeWorkState({
    recordedStatus: activity.status,
    hasSchedule: !!(activity.plannedStart && activity.plannedEnd),
    blockingReasons: reasons,
    missingPreparation: [],
    preparationGateDefined: false,
  });

  return { activityId, ...state };
}

export interface PourReadinessDetail extends WorkStateResult {
  pourId: string;
  missingChecklistLabels: string[];
  viaOverride: boolean;
}

/** Beton dökümünün bağımlılık + hazırlık kapısı durumu. */
export async function getPourReadinessDetail(pourId: string): Promise<PourReadinessDetail> {
  const pour = await prisma.concretePour.findUniqueOrThrow({
    where: { id: pourId },
    include: {
      checklistItems: true,
      structureElement: true,
      pile: { include: { pileGroup: { include: { element: true } } } },
      segment: { include: { pierElement: true } },
    },
  });

  const element =
    pour.structureElement ??
    pour.pile?.pileGroup.element ??
    pour.segment?.pierElement ??
    null;

  const [drawingStates, ncrs] = element
    ? await Promise.all([getDrawingStates(element.id), getElementNCRs(element.id, element.parentId)])
    : [[], []];

  const reasons: BlockingReason[] = [
    ...ncrBlockingReasons(ncrs),
    ...drawingBlockingReasons(drawingStates),
  ];

  const gate = evaluatePourReadiness({
    checklistItems: pour.checklistItems.map((i) => ({
      itemKey: i.itemKey,
      label: i.label,
      isChecked: i.isChecked,
    })),
    isOverride: pour.isOverride,
    overrideReason: pour.overrideReason,
  });

  const state = computeWorkState({
    recordedStatus: pour.status,
    hasSchedule: !!pour.plannedDate,
    blockingReasons: reasons,
    missingPreparation: gate.isReady
      ? []
      : gate.missingItems.map((i) => ({ label: i.label })),
    preparationGateDefined: pour.checklistItems.length > 0,
  });

  return {
    pourId,
    ...state,
    missingChecklistLabels: gate.missingItems.map((i) => i.label),
    viaOverride: gate.viaOverride,
  };
}
