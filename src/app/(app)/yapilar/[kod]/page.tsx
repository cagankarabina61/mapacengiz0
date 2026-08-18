// Yapı detayı — sekmeli proje yönetimi (§42/§44/§49/§50/§55/§56).
// "Dengeli Konsol" sekmesi YALNIZCA structure.hasBalancedCantilever ise görünür;
// koşul DB alanından gelir, kodda VIA kodu hard-code edilmez (§61).
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AKTIF } from "@/lib/archive";
import { Badge, Card, EmptyState, PageTitle, StatusBadge, buttonPrimary } from "@/components/ui";
import {
  ELEMENT_STATUS_LABELS,
  ELEMENT_TYPE_LABELS,
  OVERALL_LABELS,
  POUR_STATUS_LABELS,
  SEGMENT_STATUS_LABELS,
  STRUCTURE_TYPE_LABELS,
  UNSPECIFIED,
  label,
} from "@/lib/labels";
import { summarizePileGroup } from "@/lib/logic/piles";
import { getElementDependencies, getStructureDependencies, describeDependencies } from "@/lib/services/dependencies";
import { pourTargetLabel } from "@/lib/services/pours";
import {
  StructureEditForm,
  StructureDangerZone,
  AddElementForm,
  PierSetupForm,
  ElementActions,
  SegmentPlanForm,
  AddSegmentsForm,
} from "./structure-tabs-client";

export const dynamic = "force-dynamic";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function YapiDetayPage({
  params,
  searchParams,
}: {
  params: Promise<{ kod: string }>;
  searchParams: Promise<{ sekme?: string }>;
}) {
  const { kod } = await params;
  const { sekme } = await searchParams;

  const structure = await prisma.structure.findUnique({
    where: { code: decodeURIComponent(kod) },
    include: {
      elements: {
        orderBy: { sequenceIndex: "asc" },
        include: {
          children: { orderBy: { sequenceIndex: "asc" } },
          pileGroups: { include: { piles: true } },
          activities: { orderBy: { sequenceIndex: "asc" } },
        },
      },
    },
  });
  if (!structure) notFound();

  // Sekme listesi — Dengeli Konsol koşullu (§44)
  const tabs = [
    { key: "genel", label: "Genel" },
    { key: "elemanlar", label: "Elemanlar" },
    { key: "beton", label: "Beton" },
    ...(structure.hasBalancedCantilever
      ? [{ key: "dk", label: "Dengeli Konsol" } as const]
      : []),
  ];
  const activeTab = tabs.find((t) => t.key === sekme) ?? tabs[0];

  return (
    <div className="space-y-4">
      <PageTitle>
        {structure.code} — {structure.name}
        {structure.isSample && (
          <span className="ml-2">
            <Badge tone="gray">ÖRNEK VERİ</Badge>
          </span>
        )}
        {structure.archivedAt && (
          <span className="ml-2">
            <Badge tone="gray">Arşivli</Badge>
          </span>
        )}
      </PageTitle>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/yapilar/${encodeURIComponent(structure.code)}?sekme=${t.key}`}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              t.key === activeTab.key
                ? "bg-blue-700 text-white"
                : "bg-white border border-gray-300 text-gray-700"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab.key === "genel" && <GenelTab structure={structure} />}
      {activeTab.key === "elemanlar" && <ElemanlarTab structure={structure} />}
      {activeTab.key === "beton" && <BetonTab structureCode={structure.code} />}
      {activeTab.key === "dk" && <DengeliKonsolTab structureId={structure.id} />}
    </div>
  );
}

// ── Genel sekmesi (§50/§51) ───────────────────────────────────────────────

async function GenelTab({
  structure,
}: {
  structure: {
    id: string;
    code: string;
    name: string;
    type: string;
    hasBalancedCantilever: boolean;
    startChainage: string | null;
    endChainage: string | null;
    archivedAt: Date | null;
    archiveReason: string | null;
  };
}) {
  const deps = await getStructureDependencies(structure.id);

  return (
    <>
      <Card title="Yapı Bilgileri">
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
          <div>
            <dt className="text-gray-500 text-xs">Kod</dt>
            <dd className="font-medium">{structure.code}</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Tip</dt>
            <dd className="font-medium">{label(STRUCTURE_TYPE_LABELS, structure.type)}</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Kilometraj</dt>
            <dd className="font-medium">
              {structure.startChainage || structure.endChainage
                ? `${structure.startChainage ?? "?"} — ${structure.endChainage ?? "?"}`
                : UNSPECIFIED}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Dengeli Konsol</dt>
            <dd className="font-medium">{structure.hasBalancedCantilever ? "Var" : "Yok"}</dd>
          </div>
        </dl>
        <StructureEditForm structure={structure} />
      </Card>

      <Card title="Arşivleme / Silme">
        <StructureDangerZone
          structureId={structure.id}
          archived={!!structure.archivedAt}
          archiveReason={structure.archiveReason}
          dependencyText={describeDependencies(deps)}
          canDelete={deps.canDelete}
        />
      </Card>
    </>
  );
}

// ── Elemanlar sekmesi (§49/§52/§57) ───────────────────────────────────────

type ElementWithRelations = {
  id: string;
  code: string;
  name: string;
  elementType: string;
  status: string;
  parentId: string | null;
  archivedAt: Date | null;
  children: { id: string; code: string; name: string; status: string; archivedAt: Date | null }[];
  pileGroups: { id: string; name: string; piles: { status: string; testStatus: string; acceptanceStatus: string }[] }[];
  activities: { id: string; name: string; status: string }[];
};

async function ElemanlarTab({
  structure,
}: {
  structure: { id: string; code: string; elements: ElementWithRelations[] };
}) {
  const topLevel = structure.elements.filter((e) => !e.parentId);

  // Her eleman için bağımlılık özeti (§57 — kullanıcıya açık bilgi)
  const deps = await Promise.all(
    topLevel.map(async (el) => ({ id: el.id, ...(await getElementDependencies(el.id)) }))
  );
  const depMap = new Map(deps.map((d) => [d.id, d]));

  return (
    <>
      <Card title="Pier Ekle (toplu kurulum)">
        <p className="text-xs text-gray-500 mb-3">
          Pier ile birlikte pile cap, gövde, kazıklar ve iş kalemleri tek adımda oluşturulabilir.
          Kaydedilmeden önce tam liste önizlenir.
        </p>
        <PierSetupForm structureId={structure.id} />
      </Card>

      <Card title="Tek Eleman Ekle">
        <AddElementForm structureId={structure.id} />
      </Card>

      {topLevel.length === 0 ? (
        <Card>
          <EmptyState message="Bu yapıda eleman tanımlanmadı. Yukarıdan ekleyebilirsiniz." />
        </Card>
      ) : (
        topLevel.map((el) => {
          const d = depMap.get(el.id);
          return (
            <Card key={el.id} className={el.archivedAt ? "opacity-60" : ""}>
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <p className="font-semibold text-sm">
                    {el.name}{" "}
                    <span className="text-xs text-slate-500 font-normal">({el.code})</span>
                    {el.archivedAt && (
                      <span className="ml-2">
                        <Badge tone="gray">Arşivli</Badge>
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {label(ELEMENT_TYPE_LABELS, el.elementType)}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <StatusBadge
                    status={el.status}
                    labelText={label(ELEMENT_STATUS_LABELS, el.status)}
                  />
                  <ElementActions
                    elementId={el.id}
                    elementName={el.name}
                    archived={!!el.archivedAt}
                    dependencyText={d ? describeDependencies(d) : ""}
                    canDelete={d?.canDelete ?? false}
                  />
                </div>
              </div>

              {el.pileGroups.map((group) => {
                const summary = summarizePileGroup(group.piles);
                return (
                  <div key={group.id} className="mt-3 bg-gray-50 rounded p-3 text-sm">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="font-medium">{group.name}</p>
                      <StatusBadge
                        status={summary.overall}
                        labelText={label(OVERALL_LABELS, summary.overall)}
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Kazık: {summary.concreted}/{summary.total} betonlandı · Test:{" "}
                      {summary.tested}/{summary.total} · Kabul: {summary.accepted}/{summary.total}
                    </p>
                    <Link
                      href={`/kazik?grup=${group.id}`}
                      className="text-xs text-blue-700 hover:underline mt-1 inline-block"
                    >
                      Kazıkları gör
                    </Link>
                  </div>
                );
              })}

              {el.children.length > 0 && (
                <ul className="mt-3 divide-y divide-gray-100">
                  {el.children.map((child) => (
                    <li key={child.id} className="py-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm">
                          {child.name}
                          {child.archivedAt && (
                            <span className="ml-2">
                              <Badge tone="gray">Arşivli</Badge>
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">{child.code}</p>
                      </div>
                      <StatusBadge
                        status={child.status}
                        labelText={label(ELEMENT_STATUS_LABELS, child.status)}
                      />
                    </li>
                  ))}
                </ul>
              )}

              {el.activities.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1">İş Kalemleri</p>
                  <ul className="flex flex-wrap gap-2">
                    {el.activities.map((a) => (
                      <li key={a.id}>
                        <StatusBadge
                          status={a.status}
                          labelText={`${a.name}: ${label(ELEMENT_STATUS_LABELS, a.status)}`}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          );
        })
      )}
    </>
  );
}

// ── Beton sekmesi (§55) ───────────────────────────────────────────────────

async function BetonTab({ structureCode }: { structureCode: string }) {
  const pours = await prisma.concretePour.findMany({
    where: {
      status: { not: "IPTAL" },
      OR: [
        { structureElement: { structure: { code: structureCode } } },
        { pile: { pileGroup: { element: { structure: { code: structureCode } } } } },
        { segment: { pierElement: { structure: { code: structureCode } } } },
      ],
    },
    include: {
      pile: true,
      structureElement: true,
      segment: true,
      pumpResource: true,
      crewResource: true,
      responsibleUser: true,
    },
    orderBy: [{ plannedDate: "desc" }],
    take: 100,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const groups = [
    { title: "Bugün", items: pours.filter((p) => p.plannedDate >= today && p.plannedDate < tomorrow) },
    {
      title: "Yarın",
      items: pours.filter((p) => p.plannedDate >= tomorrow && p.plannedDate < dayAfter),
    },
    { title: "Diğer", items: pours.filter((p) => p.plannedDate < today || p.plannedDate >= dayAfter) },
  ];

  return (
    <>
      <Card>
        <Link
          href={`/beton/yeni?yapi=${encodeURIComponent(structureCode)}`}
          className={`${buttonPrimary}`}
        >
          + Bu Yapıya Beton Dökümü
        </Link>
      </Card>

      {pours.length === 0 ? (
        <Card>
          <EmptyState message="Bu yapıya ait beton dökümü kaydı yok." />
        </Card>
      ) : (
        groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <Card key={g.title} title={`${g.title} (${g.items.length})`}>
              <ul className="divide-y divide-gray-100">
                {g.items.map((pour) => (
                  <li key={pour.id} className="py-2 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/beton/${pour.code}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {pourTargetLabel(pour)}
                      </Link>
                      <p className="text-xs text-gray-500">
                        {pour.plannedDate.toLocaleDateString("tr-TR")} {pour.plannedTime ?? ""} ·{" "}
                        {pour.plannedVolumeM3.toString()} m³ ·{" "}
                        {pour.concreteClass ?? UNSPECIFIED}
                        {pour.responsibleUser ? ` · ${pour.responsibleUser.name}` : ""}
                      </p>
                    </div>
                    <StatusBadge
                      status={pour.status}
                      labelText={label(POUR_STATUS_LABELS, pour.status)}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          ))
      )}
    </>
  );
}

// ── Dengeli Konsol sekmesi (§47/§48/§56) ──────────────────────────────────

async function DengeliKonsolTab({ structureId }: { structureId: string }) {
  const [segments, resources, engineers, piers] = await Promise.all([
    prisma.balancedCantileverSegment.findMany({
      where: { pierElement: { structureId } },
      include: { pierElement: true },
      orderBy: [{ side: "asc" }, { segmentNumber: "asc" }],
    }),
    prisma.resource.findMany({ orderBy: { code: "asc" } }),
    prisma.user.findMany({
      where: { active: true, role: { in: ["SAHA_MUHENDISI", "TEKNIK_OFIS", "YONETICI"] } },
      orderBy: { name: "asc" },
    }),
    prisma.structureElement.findMany({
      where: { structureId, ...AKTIF, elementType: { in: ["PIER", "PIER_GOVDESI"] } },
      orderBy: { code: "asc" },
    }),
  ]);

  const pumps = resources
    .filter((r) => r.type === "POMPA")
    .map((r) => ({ id: r.id, label: `${r.code} — ${r.name}` }));
  const crews = resources
    .filter((r) => r.type.endsWith("_EKIBI"))
    .map((r) => ({ id: r.id, label: r.name }));
  const engineerOptions = engineers.map((u) => ({ id: u.id, label: u.name }));

  // Pier bazında grupla
  const byPier = new Map<string, typeof segments>();
  for (const s of segments) {
    const key = s.pierElementId;
    if (!byPier.has(key)) byPier.set(key, []);
    byPier.get(key)!.push(s);
  }

  return (
    <>
      <Card title="Segment Ekle">
        <AddSegmentsForm piers={piers.map((p) => ({ id: p.id, name: `${p.name} (${p.code})` }))} />
      </Card>

      {segments.length === 0 ? (
        <Card>
          <EmptyState message="Bu yapıda dengeli konsol segmenti tanımlanmadı." />
        </Card>
      ) : (
        [...byPier.entries()].map(([pierId, segs]) => (
          <Card key={pierId} title={`${segs[0].pierElement.name} — ${segs.length} segment`}>
            <p className="text-xs text-gray-500 mb-3">
              Segmentin tarihi, pompası, ekibi ve sorumlusu burada planlanır; bu bilgiler günlük
              plan, look-ahead ve kaynak çakışma kontrolüne otomatik yansır.
            </p>
            <ul className="space-y-3">
              {segs.map((s) => (
                <li key={s.id} className="border-b border-gray-100 pb-3 last:border-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-medium">
                      {s.side === "SOL" ? "Sol" : s.side === "SAG" ? "Sağ" : "Tek"} S
                      {s.segmentNumber}
                    </span>
                    <span className="text-xs text-slate-500">{s.code}</span>
                    <StatusBadge
                      status={s.status}
                      labelText={label(SEGMENT_STATUS_LABELS, s.status)}
                    />
                  </div>
                  <SegmentPlanForm
                    segment={{
                      id: s.id,
                      code: s.code,
                      label: `S${s.segmentNumber}`,
                      pierName: s.pierElement.name,
                      plannedDate: iso(s.plannedDate),
                      plannedEnd: iso(s.plannedEnd),
                      pumpResourceId: s.pumpResourceId,
                      crewResourceId: s.crewResourceId,
                      responsibleUserId: s.responsibleUserId,
                      status: s.status,
                    }}
                    pumps={pumps}
                    crews={crews}
                    engineers={engineerOptions}
                  />
                </li>
              ))}
            </ul>
            <Link
              href="/segmentler"
              className="text-xs text-blue-700 hover:underline mt-3 inline-block"
            >
              Segment adım panosunu aç (donatı/kalıp/beton ilerlemesi)
            </Link>
          </Card>
        ))
      )}
    </>
  );
}
