// Dashboard sorguları: Bugün / Yarın / dikkat listesi.
// Risk artık iş türü bazlıdır (madde 3); dikkat listesi "neden hazır değil + ne yapılmalı"
// bilgisini taşır (madde 11). Tümü canlı sorgu — hiçbir sayı ayrıca saklanmaz (madde 52).
import { prisma } from "@/lib/db";
import { AKTIF } from "@/lib/archive";
import {
  computeRisk,
  workKindForPour,
  workKindForActivity,
  type RiskResult,
} from "@/lib/logic/risk";
import { computeDelay } from "@/lib/logic/delay";
import { highestSeverity } from "@/lib/logic/resources";
import { getPourConflicts, pourTargetLabel } from "@/lib/services/pours";
import { getPourReadinessDetail, getActivityReadiness } from "@/lib/services/readiness";
import {
  manualRisk,
  mergeAttentionItems,
  type AttentionSource,
} from "@/lib/logic/attention";
import { attachNotes, type NoteView, type NoteViewer } from "@/lib/services/notes";

export function dayRange(offsetDays: number, lengthDays = 1) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start);
  end.setDate(end.getDate() + lengthDays);
  return { start, end };
}

const pourInclude = {
  pile: true,
  structureElement: { include: { structure: true } },
  segment: true,
  pumpResource: true,
  crewResource: true,
  responsibleUser: true,
  checklistItems: true,
} as const;

export async function getPoursInRange(offsetDays: number, lengthDays = 1) {
  const { start, end } = dayRange(offsetDays, lengthDays);
  return prisma.concretePour.findMany({
    where: { plannedDate: { gte: start, lt: end }, status: { not: "IPTAL" } },
    include: pourInclude,
    orderBy: [{ plannedDate: "asc" }, { plannedTime: "asc" }],
  });
}

export async function getDelayedActivities(limit = 50) {
  const today = new Date();
  const rows = await prisma.activity.findMany({
    where: {
      status: { notIn: ["TAMAMLANDI", "IPTAL"] },
      plannedEnd: { lt: today },
    },
    include: {
      element: { include: { structure: true } },
      responsibleUser: true,
      crewResource: true,
    },
    orderBy: { plannedEnd: "asc" },
    take: limit,
  });
  return rows.map((a) => ({
    ...a,
    delay: computeDelay({
      plannedEnd: a.plannedEnd,
      actualEnd: a.actualEnd,
      isCompleted: false,
      today,
    }),
  }));
}

export interface AttentionItem {
  /** Sistem mi hesapladı, kullanıcı mı ekledi. */
  source: AttentionSource;
  kind: "POUR" | "ACTIVITY" | "ELLE";
  id: string;
  code: string;
  label: string;
  structureCode: string;
  plannedDate: Date | null;
  risk: RiskResult;
  /** Neden hazır değil. */
  reasons: string[];
  /** Ne yapılırsa hazır olur (madde 11). */
  nextActions: string[];
  /** Kim sorumlu. */
  responsible: string | null;
  state: string;
  /** Başlığın hedefi; null ise başlık link değildir. */
  href: string | null;
  /** Bu kaleme iliştirilmiş kullanıcı notları — tek toplu sorgudan gelir. */
  notes: NoteView[];
  /** Not yazarken kullanılacak polimorfik anahtar. */
  noteEntityType: string;
}

/**
 * "Bugün Dikkat Gerektiren İşler".
 *
 * İki kaynak birleşir:
 *  • SISTEM — yakın tarihli ve risk puanı ≥3 olan işler; risk kuralları iş
 *    türüne göre seçilir, her kalem neden/ne yapılmalı taşır.
 *  • ELLE   — kullanıcının eklediği kalemler; risk eşiğine tabi DEĞİLDİR.
 *
 * KATMANLAMA İLKESİ: sistemin ürettiği metin ve kalemler asla değiştirilmez,
 * gizlenmez veya bastırılmaz. Kullanıcı katmanı yalnızca EKLER.
 */
export async function getAttentionItems(viewer: NoteViewer): Promise<AttentionItem[]> {
  const now = new Date();
  const in72h = new Date(now.getTime() + 72 * 3600 * 1000);

  // ── Beton dökümleri ──────────────────────────────────
  const pours = await prisma.concretePour.findMany({
    where: { status: { notIn: ["TAMAMLANDI", "IPTAL"] }, plannedDate: { lte: in72h } },
    include: pourInclude,
    take: 100,
  });

  // Sıralı await yerine paralel — 100 kayıt için 200 gidiş-dönüş sıraya girmesin.
  const pourItems = await Promise.all(pours.map(async (pour): Promise<AttentionItem | null> => {
    const [conflicts, readiness] = await Promise.all([
      getPourConflicts(pour),
      getPourReadinessDetail(pour.id),
    ]);
    const hoursUntil = (pour.plannedDate.getTime() - now.getTime()) / 3600000;
    const kind = workKindForPour(pour.targetType);

    const risk = computeRisk(kind, {
      hoursUntilPlanned: hoursUntil,
      checklistIncomplete: pour.checklistItems.length > 0 ? !readiness.readyForWork : undefined,
      openRFI: undefined, // pour'a doğrudan RFI bağlanmıyor; eleman aktivitesinde değerlendirilir
      qaqcPending: pour.qaqcStatus !== "TAMAMLANDI",
      surveyPending: pour.surveyStatus !== "TAMAMLANDI",
      holdPointPending: pour.itpStatus !== "TAMAMLANDI",
      resourceConflict: highestSeverity(conflicts),
      drawingMissing: readiness.reasons.some((r) => r.code === "CIZIM_YOK"),
      drawingRevisionMismatch: readiness.reasons.some((r) => r.code === "CIZIM_REVIZYON"),
      ncrBlocking: readiness.reasons.some((r) => r.code === "NCR_BLOKAJ" && r.level === "BLOKAJ"),
      ncrWarning: readiness.reasons.some((r) => r.code === "NCR_BLOKAJ" && r.level === "UYARI"),
      pumpUnassigned: !pour.pumpResourceId,
      crewUnassigned: !pour.crewResourceId,
      overdue: hoursUntil < 0,
      delayDays: hoursUntil < 0 ? Math.ceil(-hoursUntil / 24) : 0,
    });

    if (risk.score < 3) return null;

    const reasons = [
      ...readiness.reasons.map((r) => r.message),
      ...(readiness.missingChecklistLabels.length > 0
        ? [
            `Hazırlık eksik: ${readiness.missingChecklistLabels.slice(0, 3).join(", ")}${
              readiness.missingChecklistLabels.length > 3 ? "…" : ""
            }`,
          ]
        : []),
      ...conflicts.filter((c) => !c.overridden).map((c) => c.message),
    ];

    return {
      source: "SISTEM",
      kind: "POUR",
      id: pour.id,
      code: pour.code,
      label: `${pourTargetLabel(pour)} betonu`,
      structureCode: pour.structureElement?.structure.code ?? "—",
      plannedDate: pour.plannedDate,
      risk,
      reasons,
      nextActions: readiness.nextActions,
      responsible: pour.responsibleUser?.name ?? pour.crewResource?.name ?? null,
      state: readiness.summary,
      href: `/beton/${pour.code}`,
      noteEntityType: "ConcretePour",
      notes: [],
    };
  }));

  // ── Aktiviteler ──────────────────────────────────────
  const activities = await prisma.activity.findMany({
    where: {
      status: { notIn: ["TAMAMLANDI", "IPTAL"] },
      OR: [{ plannedStart: { lte: in72h } }, { plannedEnd: { lt: now } }],
    },
    include: {
      element: { include: { structure: true } },
      responsibleUser: true,
      crewResource: true,
    },
    take: 100,
  });

  const activityItems = await Promise.all(activities.map(async (a): Promise<AttentionItem | null> => {
    const readiness = await getActivityReadiness(a.id);
    const hoursUntil = a.plannedStart ? (a.plannedStart.getTime() - now.getTime()) / 3600000 : undefined;
    const delay = computeDelay({
      plannedEnd: a.plannedEnd,
      actualEnd: a.actualEnd,
      isCompleted: false,
      today: now,
    });
    const kind = workKindForActivity(a.activityType, a.element.elementType);

    const risk = computeRisk(kind, {
      hoursUntilPlanned: hoursUntil,
      openRFI: readiness.reasons.some((r) => r.code === "RFI_ACIK"),
      holdPointPending: readiness.reasons.some((r) => r.code === "ITP_HOLD_POINT"),
      drawingMissing: readiness.reasons.some((r) => r.code === "CIZIM_YOK"),
      drawingRevisionMismatch: readiness.reasons.some((r) => r.code === "CIZIM_REVIZYON"),
      ncrBlocking: readiness.reasons.some((r) => r.code === "NCR_BLOKAJ" && r.level === "BLOKAJ"),
      ncrWarning: readiness.reasons.some((r) => r.code === "NCR_BLOKAJ" && r.level === "UYARI"),
      pendingPileAcceptanceCount: readiness.reasons.some((r) => r.code === "KAZIK_KABUL")
        ? 1
        : undefined,
      crewUnassigned: !a.crewResourceId,
      overdue: delay.isDelayed,
      delayDays: delay.delayDays,
    });

    if (risk.score < 3) return null;

    return {
      source: "SISTEM",
      kind: "ACTIVITY",
      id: a.id,
      code: a.element.code,
      label: `${a.element.name} — ${a.name}`,
      structureCode: a.element.structure.code,
      plannedDate: a.plannedStart,
      risk,
      reasons: readiness.reasons.map((r) => r.message),
      nextActions: readiness.nextActions,
      responsible: a.responsibleUser?.name ?? a.crewResource?.name ?? null,
      state: readiness.summary,
      href: `/yapilar/${a.element.structure.code}`,
      noteEntityType: "Activity",
      notes: [],
    };
  }));

  const notNull = (x: AttentionItem | null): x is AttentionItem => x !== null;
  const system = [...pourItems.filter(notNull), ...activityItems.filter(notNull)];

  // ── Kullanıcının elle eklediği kalemler ──────────────
  // Geçerlilik penceresi SQL'de süzülür; "bugün/yarın" kalemleri kendiliğinden düşer.
  const manualRows = await prisma.userAttentionItem.findMany({
    where: {
      status: "ACIK",
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gte: now } }],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const manual: AttentionItem[] = manualRows.map((m) => ({
    source: "ELLE",
    kind: "ELLE",
    id: m.id,
    code: m.structureCode ?? "—",
    label: m.label,
    structureCode: m.structureCode ?? "—",
    plannedDate: m.validUntil ?? m.validFrom,
    risk: manualRisk(m.level),
    reasons: m.reasons,
    nextActions: m.nextActions,
    responsible: m.responsible,
    state: m.detail ?? "",
    href: m.linkHref,
    noteEntityType: "UserAttentionItem",
    notes: [],
  }));

  const items = mergeAttentionItems(system, manual);
  // Notlar TEK toplu sorguyla eklenir — kalem başına sorgu YOK.
  await attachNotes(items, viewer);
  return items;
}

/** Ana dashboard sayaçları. */
export async function getDashboardCounts() {
  const today = dayRange(0);
  const tomorrow = dayRange(1);
  const now = new Date();

  const [
    poursToday,
    poursTomorrow,
    poursReady,
    poursNotReady,
    inspectionsPending,
    delayedCount,
    activeStructures,
  ] = await Promise.all([
    prisma.concretePour.count({
      where: { plannedDate: { gte: today.start, lt: today.end }, status: { not: "IPTAL" } },
    }),
    prisma.concretePour.count({
      where: { plannedDate: { gte: tomorrow.start, lt: tomorrow.end }, status: { not: "IPTAL" } },
    }),
    prisma.concretePour.count({
      where: {
        status: { notIn: ["TAMAMLANDI", "IPTAL"] },
        checklistItems: { none: { isChecked: false } },
      },
    }),
    prisma.concretePour.count({
      where: {
        status: { notIn: ["TAMAMLANDI", "IPTAL"] },
        checklistItems: { some: { isChecked: false } },
      },
    }),
    prisma.inspection.count({ where: { result: "BEKLIYOR" } }),
    prisma.activity.count({
      where: { status: { notIn: ["TAMAMLANDI", "IPTAL"] }, plannedEnd: { lt: now } },
    }),
    prisma.structure.count({ where: AKTIF }),
  ]);

  return {
    poursToday,
    poursTomorrow,
    poursReady,
    poursNotReady,
    inspectionsPending,
    delayedCount,
    activeStructures,
  };
}
