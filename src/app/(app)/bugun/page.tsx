// Bugün / Yarın / 7 Gün — İş bazlı ve EKİP BAZLI görünüm (madde 2/11).
import Link from "next/link";
import { getDelayedActivities } from "@/lib/services/dashboard";
import { getPlanItems, groupByCrew, rangeFromToday, type PlanItem } from "@/lib/services/planning";
import { prisma } from "@/lib/db";
import type { ResourceType } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getSectionNotes } from "@/lib/services/notes";
import { StatusBadge, EmptyState, Badge, Chip, Chips, ChipDivider } from "@/components/ui";
import { SectionCard } from "@/components/section-card";
import { ACTIVITY_STATUS_LABELS, POUR_STATUS_LABELS, UNSPECIFIED, label } from "@/lib/labels";
import { QuickEditButton, type CrewOption } from "./quick-edit-button";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "bugun", label: "Bugün", offset: 0, length: 1 },
  { key: "yarin", label: "Yarın", offset: 1, length: 1 },
  { key: "hafta", label: "7 Gün", offset: 0, length: 7 },
] as const;

const MODES = [
  { key: "is", label: "İş Bazlı" },
  { key: "ekip", label: "Ekip Bazlı" },
] as const;

/** Ekip alanına atanabilecek kaynak türleri — POMPA/VINC ekipmandır, hariç. */
const CREW_TYPES: ResourceType[] = [
  "KALIP_EKIBI",
  "DONATI_EKIBI",
  "BETON_EKIBI",
  "SURVEY_EKIBI",
  "QAQC_EKIBI",
];

function statusLabel(item: PlanItem) {
  return item.kind === "POUR"
    ? label(POUR_STATUS_LABELS, item.status)
    : label(ACTIVITY_STATUS_LABELS, item.status);
}

function itemHref(item: PlanItem) {
  return item.kind === "POUR" ? `/beton/${item.code}` : `/yapilar/${item.structureCode}`;
}

function ItemRow({
  item,
  canEdit,
  crews,
}: {
  item: PlanItem;
  canEdit: boolean;
  crews: CrewOption[];
}) {
  const team = [
    item.responsibleName && `Sorumlu: ${item.responsibleName}`,
    item.crewName && `Ekip: ${item.crewName}`,
    item.qaqcName && `QA/QC: ${item.qaqcName}`,
    item.surveyName && `Survey: ${item.surveyName}`,
    item.equipmentName && `Ekipman: ${item.equipmentName}`,
  ].filter(Boolean);

  // Segmentlerin ayrı bir hızlı düzenleme action'ı yok (Faz 3).
  const editable = canEdit && (item.kind === "ACTIVITY" || item.kind === "POUR");

  return (
    <li className="py-2 flex items-start gap-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <Link href={itemHref(item)} className="text-sm font-medium hover:underline">
          {item.structureCode} {item.elementName} — {item.workName}
        </Link>
        <p className="text-xs text-gray-500">
          {item.plannedStart?.toLocaleDateString("tr-TR") ?? UNSPECIFIED}
          {item.kind === "POUR" && item.plannedStart
            ? ` ${item.plannedStart.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`
            : ""}{" "}
          → {item.plannedEnd?.toLocaleDateString("tr-TR") ?? UNSPECIFIED}
        </p>
        <p className="text-xs text-gray-500">
          {team.length > 0 ? team.join(" · ") : "Atama yapılmamış"}
        </p>
      </div>
      {item.isDelayed && <Badge tone="red">{item.delayDays} gün gecikme</Badge>}
      <StatusBadge status={item.status} labelText={statusLabel(item)} />
      {editable && (
        <QuickEditButton
          crews={crews}
          target={{
            id: item.id,
            kind: item.kind as "ACTIVITY" | "POUR",
            title: `${item.structureCode} ${item.elementName} — ${item.workName}`,
            status: item.status,
            crewResourceId: item.crewResourceId,
            hasStart: item.actualStart !== null,
            hasEnd: item.actualEnd !== null,
          }}
        />
      )}
    </li>
  );
}

export default async function BugunPage({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string; mod?: string }>;
}) {
  const { sekme, mod } = await searchParams;
  const tab = TABS.find((t) => t.key === sekme) ?? TABS[0];
  const mode = MODES.find((m) => m.key === mod) ?? MODES[0];

  const session = await requireSession();
  const viewer = { id: session.user.id, role: session.user.role };
  const { start, end } = rangeFromToday(tab.offset, tab.length);

  const [items, delayed, canEditActivity, canWriteNote, crews, sectionNotes] = await Promise.all([
    getPlanItems(start, end),
    getDelayedActivities(20),
    hasPermission(session.user.role, "activity", "update"),
    hasPermission(session.user.role, "note", "create"),
    // Ekip listesi sayfa başına BİR kez çekilir, satır başına asla.
    // Ekipman türleri (POMPA/VINC) hariç — bunlar ekip alanına atanmaz.
    prisma.resource.findMany({
      where: { type: { in: CREW_TYPES } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getSectionNotes(
      ["bugun.beton", "bugun.isler", "bugun.segment", "bugun.geciken", "bugun.ekip"],
      viewer
    ),
  ]);

  const pours = items.filter((i) => i.kind === "POUR");
  const activities = items.filter((i) => i.kind === "ACTIVITY");
  // Segmentler daha önce "İş Bazlı" modda sessizce düşüyordu — artık kendi bölümünde.
  const segments = items.filter((i) => i.kind === "SEGMENT");
  // groupByCrew önceden iki kez çağrılıyordu (uzunluk kontrolü + map).
  const crewGroups = groupByCrew(items);

  const rowProps = { canEdit: canEditActivity, crews };
  const notesFor = (k: string) => sectionNotes.get(`Section:${k}`) ?? [];

  return (
    <div className="space-y-4">
      <Chips>
        {TABS.map((t) => (
          <Chip
            key={t.key}
            href={`/bugun?sekme=${t.key}&mod=${mode.key}`}
            active={t.key === tab.key}
          >
            {t.label}
          </Chip>
        ))}
        <ChipDivider />
        {MODES.map((m) => (
          <Chip
            key={m.key}
            href={`/bugun?sekme=${tab.key}&mod=${m.key}`}
            active={m.key === mode.key}
          >
            {m.label}
          </Chip>
        ))}
      </Chips>

      {mode.key === "ekip" ? (
        crewGroups.length === 0 ? (
          <SectionCard
            sectionKey="bugun.ekip"
            title={`${tab.label} — Ekip Bazlı`}
            notes={notesFor("bugun.ekip")}
            canWriteNote={canWriteNote}
          >
            <EmptyState message="Bu aralıkta planlanmış iş yok." />
          </SectionCard>
        ) : (
          <>
            <SectionCard
              sectionKey="bugun.ekip"
              title={`${tab.label} — Ekip Bazlı`}
              notes={notesFor("bugun.ekip")}
              canWriteNote={canWriteNote}
            >
              <p className="text-xs text-gray-500">
                {crewGroups.length} grup · {items.length} iş
              </p>
            </SectionCard>
            {crewGroups.map((group) => (
              <SectionCard
                key={group.key}
                sectionKey="bugun.ekip"
                title={`${group.label} — ${group.items.length} iş`}
                notesEntityId={`bugun.ekip:${group.key}`}
                notes={[]}
                canWriteNote={false}
              >
                <ul className="divide-y divide-gray-100">
                  {group.items.map((item) => (
                    <ItemRow key={`${item.kind}-${item.id}`} item={item} {...rowProps} />
                  ))}
                </ul>
              </SectionCard>
            ))}
          </>
        )
      ) : (
        <>
          <SectionCard
            sectionKey="bugun.beton"
            title={`${tab.label} — Beton Dökümleri`}
            notes={notesFor("bugun.beton")}
            canWriteNote={canWriteNote}
          >
            {pours.length === 0 ? (
              <EmptyState message="Bu aralıkta planlanmış beton dökümü yok." />
            ) : (
              <ul className="divide-y divide-gray-100">
                {pours.map((item) => (
                  <ItemRow key={item.id} item={item} {...rowProps} />
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            sectionKey="bugun.isler"
            title={`${tab.label} — Planlanan İşler`}
            notes={notesFor("bugun.isler")}
            canWriteNote={canWriteNote}
          >
            {activities.length === 0 ? (
              <EmptyState message="Bu aralıkta planlanmış iş yok." />
            ) : (
              <ul className="divide-y divide-gray-100">
                {activities.map((item) => (
                  <ItemRow key={item.id} item={item} {...rowProps} />
                ))}
              </ul>
            )}
          </SectionCard>

          {segments.length > 0 && (
            <SectionCard
              sectionKey="bugun.segment"
              title={`${tab.label} — Segment İşleri`}
              notes={notesFor("bugun.segment")}
              canWriteNote={canWriteNote}
            >
              <ul className="divide-y divide-gray-100">
                {segments.map((item) => (
                  <ItemRow key={item.id} item={item} {...rowProps} />
                ))}
              </ul>
            </SectionCard>
          )}
        </>
      )}

      <SectionCard
        sectionKey="bugun.geciken"
        notes={notesFor("bugun.geciken")}
        canWriteNote={canWriteNote}
      >
        {delayed.length === 0 ? (
          <EmptyState message="Geciken iş yok." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {delayed.map((a) => (
              <li key={a.id} className="py-2 flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {a.element.structure.code} {a.element.name} — {a.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    Planlanan bitiş: {a.plannedEnd?.toLocaleDateString("tr-TR")}
                    {a.responsibleUser ? ` · Sorumlu: ${a.responsibleUser.name}` : ""}
                    {a.crewResource ? ` · Ekip: ${a.crewResource.name}` : ""}
                  </p>
                </div>
                <Badge tone="red">Gecikmiş ({a.delay.delayDays} gün)</Badge>
                {canEditActivity && (
                  <QuickEditButton
                    crews={crews}
                    target={{
                      id: a.id,
                      kind: "ACTIVITY",
                      title: `${a.element.structure.code} ${a.element.name} — ${a.name}`,
                      status: a.status,
                      crewResourceId: a.crewResourceId,
                      hasStart: a.actualStart !== null,
                      hasEnd: a.actualEnd !== null,
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
