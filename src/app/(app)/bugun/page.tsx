// Bugün / Yarın / 7 Gün — İş bazlı ve EKİP BAZLI görünüm (madde 2/11).
import Link from "next/link";
import { getDelayedActivities } from "@/lib/services/dashboard";
import { getPlanItems, groupByCrew, rangeFromToday, type PlanItem } from "@/lib/services/planning";
import { Card, StatusBadge, EmptyState, Badge } from "@/components/ui";
import { ACTIVITY_STATUS_LABELS, POUR_STATUS_LABELS, UNSPECIFIED, label } from "@/lib/labels";

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

function statusLabel(item: PlanItem) {
  return item.kind === "POUR"
    ? label(POUR_STATUS_LABELS, item.status)
    : label(ACTIVITY_STATUS_LABELS, item.status);
}

function itemHref(item: PlanItem) {
  return item.kind === "POUR" ? `/beton/${item.code}` : `/yapilar/${item.structureCode}`;
}

function ItemRow({ item }: { item: PlanItem }) {
  const team = [
    item.responsibleName && `Sorumlu: ${item.responsibleName}`,
    item.crewName && `Ekip: ${item.crewName}`,
    item.qaqcName && `QA/QC: ${item.qaqcName}`,
    item.surveyName && `Survey: ${item.surveyName}`,
    item.equipmentName && `Ekipman: ${item.equipmentName}`,
  ].filter(Boolean);
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

  const { start, end } = rangeFromToday(tab.offset, tab.length);
  const [items, delayed] = await Promise.all([getPlanItems(start, end), getDelayedActivities(20)]);

  const pours = items.filter((i) => i.kind === "POUR");
  const activities = items.filter((i) => i.kind === "ACTIVITY");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/bugun?sekme=${t.key}&mod=${mode.key}`}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              t.key === tab.key
                ? "bg-blue-700 text-white"
                : "bg-white border border-gray-300 text-gray-700"
            }`}
          >
            {t.label}
          </Link>
        ))}
        <span className="w-px bg-gray-300 mx-1" />
        {MODES.map((m) => (
          <Link
            key={m.key}
            href={`/bugun?sekme=${tab.key}&mod=${m.key}`}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              m.key === mode.key
                ? "bg-slate-800 text-white"
                : "bg-white border border-gray-300 text-gray-700"
            }`}
          >
            {m.label}
          </Link>
        ))}
      </div>

      {mode.key === "ekip" ? (
        groupByCrew(items).length === 0 ? (
          <Card>
            <EmptyState message="Bu aralıkta planlanmış iş yok." />
          </Card>
        ) : (
          groupByCrew(items).map((group) => (
            <Card key={group.key} title={`${group.label} — ${group.items.length} iş`}>
              <ul className="divide-y divide-gray-100">
                {group.items.map((item) => (
                  <ItemRow key={`${item.kind}-${item.id}`} item={item} />
                ))}
              </ul>
            </Card>
          ))
        )
      ) : (
        <>
          <Card title={`${tab.label} — Beton Dökümleri`}>
            {pours.length === 0 ? (
              <EmptyState message="Bu aralıkta planlanmış beton dökümü yok." />
            ) : (
              <ul className="divide-y divide-gray-100">
                {pours.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </Card>

          <Card title={`${tab.label} — Planlanan İşler`}>
            {activities.length === 0 ? (
              <EmptyState message="Bu aralıkta planlanmış iş yok." />
            ) : (
              <ul className="divide-y divide-gray-100">
                {activities.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <Card title="Geciken İşler">
        {delayed.length === 0 ? (
          <EmptyState message="Geciken iş yok." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {delayed.map((a) => (
              <li key={a.id} className="py-2 flex items-center gap-3">
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
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
