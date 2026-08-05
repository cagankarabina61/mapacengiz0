// Planlama servisi (madde 1): Gantt, 7 günlük ve 3 haftalık look-ahead.
// AYRI BİR SCHEDULE TABLOSU YOKTUR. Tek doğru kaynak mevcut Activity (ve ConcretePour)
// kayıtlarıdır; bu görünümler yalnızca aynı veriyi farklı biçimde okur (madde 52).
import { prisma } from "@/lib/db";
import { computeDelay } from "@/lib/logic/delay";
import { pourWindow } from "@/lib/logic/pour-planning";
import { pourTargetLabel } from "@/lib/services/pours";

export interface PlanItem {
  id: string;
  /** SEGMENT: dengeli konsol segmentinin kendi planı/kaynakları (§48). */
  kind: "ACTIVITY" | "POUR" | "SEGMENT";
  code: string;
  /** Yapı kodu (VIA-11). */
  structureCode: string;
  /** Eleman adı (P5 Pile Cap). */
  elementName: string;
  /** İş adı (Donatı / Beton dökümü). */
  workName: string;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  status: string;
  /** Sorumlu mühendis adı. */
  responsibleName: string | null;
  /** Sorumlu ekip adı. */
  crewName: string | null;
  /** QA/QC sorumlusu. */
  qaqcName: string | null;
  /** Survey sorumlusu. */
  surveyName: string | null;
  /** Ekipman (pompa/vinç). */
  equipmentName: string | null;
  isDelayed: boolean;
  delayDays: number;
}

export function rangeFromToday(startOffsetDays: number, lengthDays: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + startOffsetDays);
  const end = new Date(start);
  end.setDate(end.getDate() + lengthDays);
  return { start, end };
}

/**
 * Verilen aralıkla kesişen tüm planlanmış işler (aktivite + beton dökümü).
 * Kesişim: iş aralığı [plannedStart, plannedEnd] ile pencere çakışıyorsa dahil edilir.
 */
export async function getPlanItems(start: Date, end: Date): Promise<PlanItem[]> {
  const today = new Date();

  const [activities, pours, segments] = await Promise.all([
    prisma.activity.findMany({
      where: {
        status: { not: "IPTAL" },
        OR: [
          { plannedStart: { gte: start, lt: end } },
          { plannedEnd: { gte: start, lt: end } },
          { AND: [{ plannedStart: { lte: start } }, { plannedEnd: { gte: end } }] },
        ],
      },
      include: {
        element: { include: { structure: true } },
        responsibleUser: true,
        qaqcUser: true,
        surveyUser: true,
        crewResource: true,
        equipmentResource: true,
      },
      orderBy: [{ plannedStart: "asc" }],
      take: 500,
    }),
    prisma.concretePour.findMany({
      where: { status: { not: "IPTAL" }, plannedDate: { gte: start, lt: end } },
      include: {
        pile: true,
        structureElement: { include: { structure: true } },
        segment: { include: { pierElement: { include: { structure: true } } } },
        pumpResource: true,
        crewResource: true,
        responsibleUser: true,
      },
      orderBy: [{ plannedDate: "asc" }, { plannedTime: "asc" }],
      take: 300,
    }),
    // Dengeli konsol segmentleri (§48): segmentin KENDİ planı ve kaynakları.
    // Bir segment beton dökümü olmadan da planlanmış olabilir — look-ahead'de görünmeli.
    prisma.balancedCantileverSegment.findMany({
      where: { status: { not: "IPTAL" }, plannedDate: { gte: start, lt: end } },
      include: {
        pierElement: { include: { structure: true } },
        pumpResource: true,
        crewResource: true,
        responsibleUser: true,
      },
      orderBy: [{ plannedDate: "asc" }, { segmentNumber: "asc" }],
      take: 300,
    }),
  ]);

  const userNames = new Map(
    (await prisma.user.findMany({ select: { id: true, name: true } })).map((u) => [u.id, u.name])
  );

  const activityItems: PlanItem[] = activities.map((a) => {
    const delay = computeDelay({
      plannedEnd: a.plannedEnd,
      actualEnd: a.actualEnd,
      isCompleted: a.status === "TAMAMLANDI",
      today,
    });
    return {
      id: a.id,
      kind: "ACTIVITY",
      code: a.element.code,
      structureCode: a.element.structure.code,
      elementName: a.element.name,
      workName: a.name,
      plannedStart: a.plannedStart,
      plannedEnd: a.plannedEnd,
      actualStart: a.actualStart,
      actualEnd: a.actualEnd,
      status: a.status,
      responsibleName: a.responsibleUser?.name ?? null,
      crewName: a.crewResource?.name ?? null,
      qaqcName: a.qaqcUser?.name ?? null,
      surveyName: a.surveyUser?.name ?? null,
      equipmentName: a.equipmentResource?.name ?? null,
      isDelayed: delay.isDelayed,
      delayDays: delay.delayDays,
    };
  });

  const pourItems: PlanItem[] = pours.map((p) => {
    const win = pourWindow(p.plannedDate, p.plannedTime, p.estimatedDurationMin);
    const structureCode =
      p.structureElement?.structure.code ??
      p.segment?.pierElement.structure.code ??
      p.pile?.code.split("-")[0] ??
      "—";
    const delay = computeDelay({
      plannedEnd: win.end,
      actualEnd: p.pourEnd,
      isCompleted: p.status === "TAMAMLANDI",
      today,
    });
    return {
      id: p.id,
      kind: "POUR",
      code: p.code,
      structureCode,
      elementName: pourTargetLabel(p),
      workName: "Beton dökümü",
      plannedStart: win.start,
      plannedEnd: win.end,
      actualStart: p.pourStart,
      actualEnd: p.pourEnd,
      status: p.status,
      responsibleName: p.responsibleUser?.name ?? null,
      crewName: p.crewResource?.name ?? null,
      qaqcName: p.qaqcUserId ? (userNames.get(p.qaqcUserId) ?? null) : null,
      surveyName: p.surveyUserId ? (userNames.get(p.surveyUserId) ?? null) : null,
      equipmentName: p.pumpResource ? `${p.pumpResource.code} (Pompa)` : null,
      isDelayed: delay.isDelayed,
      delayDays: delay.delayDays,
    };
  });

  const segmentItems: PlanItem[] = segments.map((s) => {
    const delay = computeDelay({
      plannedEnd: s.plannedEnd ?? s.plannedDate,
      actualEnd: s.actualEnd,
      isCompleted: s.status === "TAMAMLANDI",
      today,
    });
    return {
      id: s.id,
      kind: "SEGMENT",
      code: s.code,
      structureCode: s.pierElement.structure.code,
      elementName: s.pierElement.name,
      workName: `${s.side === "SOL" ? "Sol" : s.side === "SAG" ? "Sağ" : ""} Segment ${s.segmentNumber}`.trim(),
      plannedStart: s.plannedDate,
      plannedEnd: s.plannedEnd ?? s.plannedDate,
      actualStart: s.actualStart,
      actualEnd: s.actualEnd,
      status: s.status,
      responsibleName: s.responsibleUser?.name ?? null,
      crewName: s.crewResource?.name ?? null,
      qaqcName: null,
      surveyName: null,
      equipmentName: s.pumpResource ? `${s.pumpResource.code} (Pompa)` : null,
      isDelayed: delay.isDelayed,
      delayDays: delay.delayDays,
    };
  });

  return [...activityItems, ...pourItems, ...segmentItems].sort((a, b) => {
    const at = a.plannedStart?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bt = b.plannedStart?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return at - bt;
  });
}

/** 7 günlük look-ahead. */
export async function getSevenDayLookAhead(): Promise<PlanItem[]> {
  const { start, end } = rangeFromToday(0, 7);
  return getPlanItems(start, end);
}

/** 3 haftalık (21 gün) look-ahead — madde 11'in ana çıktısı. */
export async function getThreeWeekLookAhead(): Promise<PlanItem[]> {
  const { start, end } = rangeFromToday(0, 21);
  return getPlanItems(start, end);
}

export interface CrewPlanGroup {
  key: string;
  label: string;
  /** Ekip / mühendis / ekipman türü. */
  kind: "EKIP" | "MUHENDIS" | "EKIPMAN" | "ATANMAMIS";
  items: PlanItem[];
}

/**
 * Ekip bazlı gruplama (madde 2): kim, hangi yapıda, hangi işi yapacak.
 * Bir iş hem ekip hem sorumlu mühendis altında görünebilir — bu kasıtlıdır.
 */
export function groupByCrew(items: PlanItem[]): CrewPlanGroup[] {
  const groups = new Map<string, CrewPlanGroup>();
  const add = (key: string, label: string, kind: CrewPlanGroup["kind"], item: PlanItem) => {
    const id = `${kind}:${key}`;
    if (!groups.has(id)) groups.set(id, { key: id, label, kind, items: [] });
    groups.get(id)!.items.push(item);
  };

  for (const item of items) {
    let assigned = false;
    if (item.crewName) {
      add(item.crewName, item.crewName, "EKIP", item);
      assigned = true;
    }
    if (item.responsibleName) {
      add(item.responsibleName, item.responsibleName, "MUHENDIS", item);
      assigned = true;
    }
    if (!assigned) add("yok", "Atanmamış işler", "ATANMAMIS", item);
  }

  const order: Record<CrewPlanGroup["kind"], number> = {
    EKIP: 0,
    MUHENDIS: 1,
    EKIPMAN: 2,
    ATANMAMIS: 3,
  };
  return [...groups.values()].sort(
    (a, b) => order[a.kind] - order[b.kind] || a.label.localeCompare(b.label, "tr")
  );
}

/** Gantt için gün sütunları. */
export function buildDayColumns(start: Date, days: number): Date[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** Bir işin Gantt satırındaki başlangıç sütunu ve genişliği (gün cinsinden). */
export function ganttSpan(
  item: PlanItem,
  windowStart: Date,
  totalDays: number
): { offset: number; span: number } | null {
  if (!item.plannedStart || !item.plannedEnd) return null;
  const dayMs = 86400000;
  const startDay = Math.floor(
    (new Date(item.plannedStart).setHours(0, 0, 0, 0) - windowStart.getTime()) / dayMs
  );
  const endDay = Math.floor(
    (new Date(item.plannedEnd).setHours(0, 0, 0, 0) - windowStart.getTime()) / dayMs
  );
  const offset = Math.max(0, startDay);
  const span = Math.min(totalDays, endDay + 1) - offset;
  if (span <= 0) return null;
  return { offset, span };
}
