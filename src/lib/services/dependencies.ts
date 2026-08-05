// Bağımlılık sayım servisi (§49/§57).
// Bir eleman veya yapı kaldırılmak istendiğinde ona bağlı kayıtları sayar ve
// kullanıcıya açıkça gösterir. Sessiz cascade delete YOKTUR — bağlı kayıt varsa
// fiziksel silme kapatılır, yalnızca arşivleme sunulur.
import { prisma } from "@/lib/db";

export interface DependencySummary {
  total: number;
  /** Kullanıcıya gösterilecek Türkçe kırılım. Yalnızca sıfırdan büyük olanlar. */
  items: { label: string; count: number }[];
  /** Fiziksel silme güvenli mi? (bağlı kayıt yoksa) */
  canDelete: boolean;
}

function summarize(counts: { label: string; count: number }[]): DependencySummary {
  const items = counts.filter((c) => c.count > 0);
  const total = items.reduce((sum, c) => sum + c.count, 0);
  return { total, items, canDelete: total === 0 };
}

/**
 * Bir yapı elemanına (pier/abutment/pile cap...) bağlı tüm kayıtları sayar.
 * Alt elemanlar ve onların altındaki kazık/segment kayıtları da dahildir.
 */
export async function getElementDependencies(elementId: string): Promise<DependencySummary> {
  const element = await prisma.structureElement.findUnique({
    where: { id: elementId },
    select: { id: true, children: { select: { id: true } } },
  });
  if (!element) return { total: 0, items: [], canDelete: false };

  // Eleman + alt elemanları birlikte değerlendirilir
  const childIds = element.children.map((c) => c.id);
  const allIds = [element.id, ...childIds];

  const [
    pileGroups,
    piles,
    activities,
    pours,
    segments,
    drawings,
    rfis,
    ncrs,
    inspections,
  ] = await Promise.all([
    prisma.pileGroup.count({ where: { elementId: { in: allIds } } }),
    prisma.pile.count({ where: { pileGroup: { elementId: { in: allIds } } } }),
    prisma.activity.count({ where: { elementId: { in: allIds } } }),
    prisma.concretePour.count({ where: { structureElementId: { in: allIds } } }),
    prisma.balancedCantileverSegment.count({ where: { pierElementId: { in: allIds } } }),
    prisma.drawing.count({ where: { elementId: { in: allIds } } }),
    prisma.rFI.count({ where: { elementId: { in: allIds } } }),
    prisma.nCR.count({ where: { elementId: { in: allIds } } }),
    prisma.inspection.count({ where: { elementId: { in: allIds } } }),
  ]);

  return summarize([
    { label: "Alt eleman", count: childIds.length },
    { label: "Kazık grubu", count: pileGroups },
    { label: "Kazık", count: piles },
    { label: "İş kalemi", count: activities },
    { label: "Beton dökümü", count: pours },
    { label: "Dengeli konsol segmenti", count: segments },
    { label: "Çizim", count: drawings },
    { label: "RFI", count: rfis },
    { label: "NCR", count: ncrs },
    { label: "QA/QC kontrolü", count: inspections },
  ]);
}

/** Bir yapıya (VIA) bağlı tüm kayıtları sayar. */
export async function getStructureDependencies(structureId: string): Promise<DependencySummary> {
  const [elements, piles, activities, pours, segments, drawings, rfis, ncrs] = await Promise.all([
    prisma.structureElement.count({ where: { structureId } }),
    prisma.pile.count({ where: { pileGroup: { element: { structureId } } } }),
    prisma.activity.count({ where: { element: { structureId } } }),
    prisma.concretePour.count({ where: { structureElement: { structureId } } }),
    prisma.balancedCantileverSegment.count({ where: { pierElement: { structureId } } }),
    prisma.drawing.count({ where: { structureId } }),
    prisma.rFI.count({ where: { structureId } }),
    prisma.nCR.count({ where: { structureId } }),
  ]);

  return summarize([
    { label: "Yapı elemanı", count: elements },
    { label: "Kazık", count: piles },
    { label: "İş kalemi", count: activities },
    { label: "Beton dökümü", count: pours },
    { label: "Dengeli konsol segmenti", count: segments },
    { label: "Çizim", count: drawings },
    { label: "RFI", count: rfis },
    { label: "NCR", count: ncrs },
  ]);
}

/** UI'da gösterilecek tek satırlık özet: "14 kayıt (4 kazık, 8 iş kalemi, 2 beton dökümü)". */
export function describeDependencies(summary: DependencySummary): string {
  if (summary.total === 0) return "Bu kayda bağlı başka kayıt bulunmamaktadır.";
  const detail = summary.items.map((i) => `${i.count} ${i.label.toLocaleLowerCase("tr")}`).join(", ");
  return `Bu kayda bağlı ${summary.total} kayıt bulunmaktadır: ${detail}.`;
}
