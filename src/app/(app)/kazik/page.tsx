// Kazık takip modülü (madde 14-16): filtreli liste + toplu güncelleme.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { AKTIF } from "@/lib/archive";
import { PageTitle, EmptyState, Card } from "@/components/ui";
import { PILE_STATUS_LABELS } from "@/lib/labels";
import { PileTable, type PileRow } from "./pile-table";
import type { PileStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export default async function KazikPage({
  searchParams,
}: {
  searchParams: Promise<{ grup?: string; durum?: string; yapi?: string; sayfa?: string }>;
}) {
  const { grup, durum, yapi, sayfa } = await searchParams;
  const page = Math.max(1, parseInt(sayfa ?? "1", 10) || 1);

  const where = {
    ...(grup ? { pileGroupId: grup } : {}),
    ...(durum && durum in PILE_STATUS_LABELS ? { status: durum as PileStatus } : {}),
    ...(yapi ? { pileGroup: { element: { structure: { code: yapi } } } } : {}),
  };

  const [piles, totalCount, structures] = await Promise.all([
    prisma.pile.findMany({
      where,
      include: { pileGroup: { include: { element: { include: { structure: true } } } } },
      orderBy: { code: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.pile.count({ where }),
    prisma.structure.findMany({ where: AKTIF, orderBy: { code: "asc" } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const rows: PileRow[] = piles.map((p) => ({
    id: p.id,
    code: p.code,
    status: p.status,
    diameterMm: p.diameterMm,
    designLengthM: p.designLengthM?.toString() ?? null,
    concreteClass: p.concreteClass,
    testStatus: p.testStatus,
    acceptanceStatus: p.acceptanceStatus,
    groupName: `${p.pileGroup.element.structure.code} ${p.pileGroup.name}`,
    problemDescription: p.problemDescription,
  }));

  return (
    <div className="space-y-4">
      <PageTitle>Kazık Takibi</PageTitle>

      {/* Filtreler (madde 45) */}
      <Card>
        <div className="flex gap-2 flex-wrap text-sm">
          <span className="text-gray-500 py-1">Yapı:</span>
          <Link
            href="/kazik"
            className={`px-2 py-1 rounded ${!yapi ? "bg-blue-700 text-white" : "bg-gray-100"}`}
          >
            Tümü
          </Link>
          {structures.map((s) => (
            <Link
              key={s.id}
              href={`/kazik?yapi=${encodeURIComponent(s.code)}`}
              className={`px-2 py-1 rounded ${yapi === s.code ? "bg-blue-700 text-white" : "bg-gray-100"}`}
            >
              {s.code}
            </Link>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap text-sm mt-2">
          <span className="text-gray-500 py-1">Durum:</span>
          <Link
            href={yapi ? `/kazik?yapi=${encodeURIComponent(yapi)}` : "/kazik"}
            className={`px-2 py-1 rounded ${!durum ? "bg-blue-700 text-white" : "bg-gray-100"}`}
          >
            Tümü
          </Link>
          {Object.entries(PILE_STATUS_LABELS).map(([value, lbl]) => (
            <Link
              key={value}
              href={`/kazik?durum=${value}${yapi ? `&yapi=${encodeURIComponent(yapi)}` : ""}`}
              className={`px-2 py-1 rounded ${durum === value ? "bg-blue-700 text-white" : "bg-gray-100"}`}
            >
              {lbl}
            </Link>
          ))}
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState message="Bu filtreye uyan kazık bulunamadı." />
        </Card>
      ) : (
        <PileTable piles={rows} />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            {totalCount} kazık · Sayfa {page}/{totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/kazik?sayfa=${page - 1}${yapi ? `&yapi=${encodeURIComponent(yapi)}` : ""}${durum ? `&durum=${durum}` : ""}`}
                className="px-3 py-1.5 rounded border border-gray-300 bg-white"
              >
                ← Önceki
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/kazik?sayfa=${page + 1}${yapi ? `&yapi=${encodeURIComponent(yapi)}` : ""}${durum ? `&durum=${durum}` : ""}`}
                className="px-3 py-1.5 rounded border border-gray-300 bg-white"
              >
                Sonraki →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
