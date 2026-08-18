// Beton döküm listesi (madde 10/12): Bugün / Yarın / Tümü sekmeleri.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { AKTIF } from "@/lib/archive";
import { compareStructureCodes } from "@/lib/logic/structure-codes";
import { dayRange } from "@/lib/services/dashboard";
import { pourTargetLabel } from "@/lib/services/pours";
import { Card, PageTitle, LinkButton, EmptyState, StatusBadge, Badge, Chip, Chips } from "@/components/ui";
import { SectionCard } from "@/components/section-card";
import { POUR_STATUS_LABELS, UNSPECIFIED, label } from "@/lib/labels";
import { evaluatePourReadiness } from "@/lib/logic/readiness";
import { requireSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getSectionNotes } from "@/lib/services/notes";

export const dynamic = "force-dynamic";

export default async function BetonPage({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string; yapi?: string }>;
}) {
  const { sekme, yapi } = await searchParams;
  const tab = sekme === "yarin" ? "yarin" : sekme === "tumu" ? "tumu" : "bugun";

  const session = await requireSession();
  const viewer = { id: session.user.id, role: session.user.role };
  const [canWriteNote, sectionNotes] = await Promise.all([
    hasPermission(session.user.role, "note", "create"),
    getSectionNotes(["beton.liste"], viewer),
  ]);

  const dateWhere =
    tab === "tumu"
      ? {}
      : (() => {
          const { start, end } = dayRange(tab === "yarin" ? 1 : 0);
          return { plannedDate: { gte: start, lt: end } };
        })();

  // Proje/VIA filtresi (§55): kullanıcı tüm projeleri görmek zorunda kalmaz
  const structureWhere = yapi
    ? {
        OR: [
          { structureElement: { structure: { code: yapi } } },
          { pile: { pileGroup: { element: { structure: { code: yapi } } } } },
          { segment: { pierElement: { structure: { code: yapi } } } },
        ],
      }
    : {};

  const where = { ...dateWhere, ...structureWhere };

  const structures = await prisma.structure.findMany({
    where: AKTIF,
    orderBy: { code: "asc" },
  });
  const sortedStructures = [...structures].sort((a, b) => compareStructureCodes(a.code, b.code));

  const pours = await prisma.concretePour.findMany({
    where,
    include: {
      pile: true,
      structureElement: { include: { structure: true } },
      segment: true,
      pumpResource: true,
      crewResource: true,
      checklistItems: true,
    },
    orderBy: [{ plannedDate: tab === "tumu" ? "desc" : "asc" }, { plannedTime: "asc" }],
    take: 100,
  });

  return (
    <div className="space-y-4">
      <PageTitle
        actions={
          <LinkButton href={`/beton/yeni${yapi ? `?yapi=${encodeURIComponent(yapi)}` : ""}`}>
            + Yeni Döküm
          </LinkButton>
        }
      >
        Beton Döküm Programı{yapi ? ` — ${yapi}` : ""}
      </PageTitle>

      <Chips>
        {[
          ["bugun", "Bugün"],
          ["yarin", "Yarın"],
          ["tumu", "Tümü"],
        ].map(([key, lbl]) => (
          <Chip
            key={key}
            href={`/beton?sekme=${key}${yapi ? `&yapi=${encodeURIComponent(yapi)}` : ""}`}
            active={tab === key}
          >
            {lbl}
          </Chip>
        ))}
      </Chips>

      {/* Proje/VIA filtresi (§55) */}
      <Card>
        <Chips>
          <span className="text-sm text-gray-500">Yapı:</span>
          <Chip href={`/beton?sekme=${tab}`} active={!yapi}>
            Tümü
          </Chip>
          {sortedStructures.map((s) => (
            <Chip
              key={s.id}
              href={`/beton?sekme=${tab}&yapi=${encodeURIComponent(s.code)}`}
              active={yapi === s.code}
            >
              {s.code}
            </Chip>
          ))}
        </Chips>
      </Card>

      <SectionCard
        sectionKey="beton.liste"
        title={`Beton Dökümleri${yapi ? ` — ${yapi}` : ""}`}
        notes={sectionNotes.get("Section:beton.liste") ?? []}
        canWriteNote={canWriteNote}
      >
        {pours.length === 0 ? (
          <EmptyState message="Bu aralıkta beton dökümü yok. Yeni döküm oluşturabilirsiniz." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {pours.map((pour) => {
              const readiness = evaluatePourReadiness({
                checklistItems: pour.checklistItems,
                isOverride: pour.isOverride,
                overrideReason: pour.overrideReason,
              });
              return (
                <li key={pour.id} className="py-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <Link href={`/beton/${pour.code}`} className="text-sm font-medium hover:underline">
                      {pourTargetLabel(pour)}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {pour.plannedDate.toLocaleDateString("tr-TR")}{" "}
                      {pour.plannedTime ?? ""} · {pour.plannedVolumeM3.toString()} m³ ·{" "}
                      {pour.concreteClass ?? UNSPECIFIED} · Pompa:{" "}
                      {pour.pumpResource?.code ?? UNSPECIFIED}
                    </p>
                  </div>
                  {pour.status === "TAMAMLANDI" || pour.status === "BETON_DOKULUYOR" ? (
                    <StatusBadge status={pour.status} labelText={label(POUR_STATUS_LABELS, pour.status)} />
                  ) : readiness.isReady ? (
                    <StatusBadge
                      status="BETON_DOKUMUNE_HAZIR"
                      labelText={readiness.viaOverride ? "Hazır (Override)" : "Beton Dökümüne Hazır"}
                    />
                  ) : (
                    <Badge tone="yellow">Hazır Değil ({readiness.missingItems.length} eksik)</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
