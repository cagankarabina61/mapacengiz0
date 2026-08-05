// Yeni beton dökümü (§45/§54): Proje/VIA → Eleman → İmalat → beton bilgileri.
import { prisma } from "@/lib/db";
import { AKTIF } from "@/lib/archive";
import { Card, PageTitle } from "@/components/ui";
import { ELEMENT_TYPE_LABELS, label } from "@/lib/labels";
import { compareStructureCodes } from "@/lib/logic/structure-codes";
import { PourForm, type TargetOption, type StructureOption } from "./pour-form";

export const dynamic = "force-dynamic";

export default async function YeniBetonPage({
  searchParams,
}: {
  searchParams: Promise<{ yapi?: string }>;
}) {
  const { yapi } = await searchParams;

  const [structures, elements, piles, segments, resources, engineers] = await Promise.all([
    prisma.structure.findMany({ where: AKTIF, orderBy: { code: "asc" } }),
    prisma.structureElement.findMany({
      // PIER dahil: kullanıcı "Eleman Ekle" ile pier eklediğinde ona da beton
      // dökümü açabilmeli (§46/§54 — VIA → P05 → Pier → Beton zinciri).
      where: {
        ...AKTIF,
        elementType: { in: ["PIER", "PILE_CAP", "PIER_GOVDESI", "BASLIK", "ABUTMENT"] },
      },
      include: { structure: true },
      orderBy: { code: "asc" },
    }),
    prisma.pile.findMany({
      where: { status: { notIn: ["KABUL_EDILDI"] }, pileGroup: { element: AKTIF } },
      include: { pileGroup: { include: { element: { include: { structure: true } } } } },
      orderBy: { code: "asc" },
    }),
    prisma.balancedCantileverSegment.findMany({
      where: { status: { notIn: ["TAMAMLANDI", "IPTAL"] }, pierElement: AKTIF },
      include: { pierElement: { include: { structure: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.resource.findMany({ orderBy: { code: "asc" } }),
    prisma.user.findMany({
      where: { active: true, role: { in: ["SAHA_MUHENDISI", "TEKNIK_OFIS", "YONETICI"] } },
      orderBy: { name: "asc" },
    }),
  ]);

  const targets: TargetOption[] = [
    ...elements.map((e) => ({
      value: `ELEM:${e.id}`,
      label: `${e.name} (${e.code})`,
      workType: label(ELEMENT_TYPE_LABELS, e.elementType),
      structureCode: e.structure.code,
    })),
    ...piles.map((p) => ({
      value: `PILE:${p.id}`,
      label: `Kazık ${p.code}`,
      workType: "Kazık",
      structureCode: p.pileGroup.element.structure.code,
    })),
    ...segments.map((s) => ({
      value: `SEG:${s.id}`,
      label: `Segment ${s.code}`,
      workType: "Dengeli Konsol Segmenti",
      structureCode: s.pierElement.structure.code,
    })),
  ];

  const structureOptions: StructureOption[] = [...structures]
    .sort((a, b) => compareStructureCodes(a.code, b.code))
    .map((s) => ({ code: s.code, name: s.name }));

  const pumps = resources
    .filter((r) => r.type === "POMPA")
    .map((r) => ({ id: r.id, label: `${r.code} — ${r.name}` }));
  const crews = resources
    .filter((r) => r.type.endsWith("_EKIBI"))
    .map((r) => ({ id: r.id, label: r.name }));

  return (
    <div className="space-y-4">
      <PageTitle>Yeni Beton Dökümü</PageTitle>
      <Card>
        <PourForm
          structures={structureOptions}
          targets={targets}
          pumps={pumps}
          crews={crews}
          engineers={engineers.map((u) => ({ id: u.id, label: u.name }))}
          initialStructure={yapi}
        />
      </Card>
    </div>
  );
}
