// Planlama (madde 1): Gantt + 7 günlük + 3 haftalık look-ahead + ekip bazlı görünüm.
// AYRI SCHEDULE TABLOSU YOK — hepsi mevcut Activity/ConcretePour kayıtlarından okunur.
import Link from "next/link";
import {
  getPlanItems,
  groupByCrew,
  rangeFromToday,
  buildDayColumns,
  ganttSpan,
  type PlanItem,
} from "@/lib/services/planning";
import { Card, PageTitle, EmptyState, StatusBadge, Badge, Chip, Chips, ChipDivider } from "@/components/ui";
import { ACTIVITY_STATUS_LABELS, POUR_STATUS_LABELS, UNSPECIFIED, label } from "@/lib/labels";

export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "7gun", label: "7 Günlük Look-Ahead", days: 7 },
  { key: "3hafta", label: "3 Haftalık Look-Ahead", days: 21 },
] as const;

const MODES = [
  { key: "gantt", label: "Gantt" },
  { key: "ekip", label: "Ekip Bazlı" },
  { key: "liste", label: "Liste" },
] as const;

function statusLabel(item: PlanItem) {
  return item.kind === "POUR"
    ? label(POUR_STATUS_LABELS, item.status)
    : label(ACTIVITY_STATUS_LABELS, item.status);
}

function itemHref(item: PlanItem) {
  return item.kind === "POUR" ? `/beton/${item.code}` : `/yapilar/${item.structureCode}`;
}

function TeamLine({ item }: { item: PlanItem }) {
  const parts: string[] = [];
  if (item.responsibleName) parts.push(`Sorumlu: ${item.responsibleName}`);
  if (item.crewName) parts.push(`Ekip: ${item.crewName}`);
  if (item.qaqcName) parts.push(`QA/QC: ${item.qaqcName}`);
  if (item.surveyName) parts.push(`Survey: ${item.surveyName}`);
  if (item.equipmentName) parts.push(`Ekipman: ${item.equipmentName}`);
  return (
    <p className="text-xs text-gray-500">
      {parts.length > 0 ? parts.join(" · ") : "Atama yapılmamış"}
    </p>
  );
}

/**
 * Telefon için gün bazlı ajanda — Gantt'ın mobil karşılığı.
 * Aynı PlanItem verisini kullanır; ek sorgu yoktur.
 */
function MobileAgenda({ items, days }: { items: PlanItem[]; days: Date[] }) {
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  // Bir iş, başlangıç–bitiş aralığındaki her güne düşer.
  const gunler = days.map((d) => ({
    tarih: d,
    isler: items.filter((i) => {
      const s = i.plannedStart;
      const e = i.plannedEnd ?? i.plannedStart;
      if (!s || !e) return false;
      return (
        (s <= d && e >= d) || sameDay(s, d) || sameDay(e, d)
      );
    }),
  }));

  const tarihsiz = items.filter((i) => !i.plannedStart);
  const dolu = gunler.filter((g) => g.isler.length > 0);

  if (dolu.length === 0 && tarihsiz.length === 0) {
    return <EmptyState message="Bu aralıkta planlanmış iş yok." />;
  }

  return (
    <div className="space-y-3">
      {dolu.map((g) => (
        <div key={g.tarih.toISOString()}>
          <p
            className={`text-xs font-semibold border-b border-gray-200 pb-1 mb-1 ${
              g.tarih.getDay() === 0 || g.tarih.getDay() === 6
                ? "text-red-500"
                : "text-gray-700"
            }`}
          >
            {g.tarih.toLocaleDateString("tr-TR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            <span className="font-normal text-slate-500"> · {g.isler.length} iş</span>
          </p>
          <ul className="divide-y divide-gray-100">
            {g.isler.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="py-2 flex items-start gap-2 flex-wrap">
                <div className="flex-1 min-w-0">
                  <Link href={itemHref(item)} className="text-sm font-medium hover:underline">
                    {item.structureCode} {item.elementName} — {item.workName}
                  </Link>
                  <TeamLine item={item} />
                </div>
                {item.isDelayed && <Badge tone="red">{item.delayDays} gün</Badge>}
                <StatusBadge status={item.status} labelText={statusLabel(item)} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {tarihsiz.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 border-b border-gray-200 pb-1 mb-1">
            Tarih girilmemiş · {tarihsiz.length} iş
          </p>
          <ul className="divide-y divide-gray-100">
            {tarihsiz.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="py-2">
                <Link href={itemHref(item)} className="text-sm font-medium hover:underline">
                  {item.structureCode} {item.elementName} — {item.workName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default async function PlanlamaPage({
  searchParams,
}: {
  searchParams: Promise<{ gorunum?: string; mod?: string }>;
}) {
  const { gorunum, mod } = await searchParams;
  const view = VIEWS.find((v) => v.key === gorunum) ?? VIEWS[0];
  const mode = MODES.find((m) => m.key === mod) ?? MODES[0];

  const { start, end } = rangeFromToday(0, view.days);
  const items = await getPlanItems(start, end);
  const days = buildDayColumns(start, view.days);

  return (
    <div className="space-y-4">
      <PageTitle>Planlama</PageTitle>

      <Chips>
        {VIEWS.map((v) => (
          <Chip
            key={v.key}
            href={`/planlama?gorunum=${v.key}&mod=${mode.key}`}
            active={v.key === view.key}
          >
            {v.label}
          </Chip>
        ))}
        <ChipDivider />
        {MODES.map((m) => (
          <Chip
            key={m.key}
            href={`/planlama?gorunum=${view.key}&mod=${m.key}`}
            active={m.key === mode.key}
          >
            {m.label}
          </Chip>
        ))}
      </Chips>

      <p className="text-xs text-gray-500">
        Bu görünümler ayrı bir program tablosundan değil, doğrudan iş kalemleri ve beton döküm
        kayıtlarından üretilir — tek doğru kaynak korunur.
      </p>

      {items.length === 0 ? (
        <Card>
          <EmptyState message="Bu aralıkta planlanmış iş yok." />
        </Card>
      ) : mode.key === "gantt" ? (
        <Card title={`${view.label} — Gantt (${items.length} iş)`}>
          {/* Telefonda Gantt render EDİLMEZ: 3 haftalık görünüm 1204px genişliğinde
              ve 280px etiket sütunu 375px ekranın %90'ını yer. Yerine gün bazlı
              ajanda listesi — aynı getPlanItems verisi, yeni sorgu yok. */}
          <div className="md:hidden">
            <MobileAgenda items={items} days={days} />
          </div>

          {/* Tablette daralt, masaüstünde bugünkü yoğunluğu koru:
              md → 160px etiket + 32px gün (3 hafta ≈ 832px, tablete sığar)
              lg → 280px etiket + 44px gün (bugünküyle birebir aynı) */}
          <div className="hidden md:block overflow-x-auto [--gantt-label:10rem] [--gantt-day:2rem] lg:[--gantt-label:17.5rem] lg:[--gantt-day:2.75rem]">
            <div className="w-max min-w-full">
              {/* Gün başlıkları */}
              <div
                className="grid text-[10px] text-gray-500 border-b border-gray-300 pb-1 mb-1"
                style={{ gridTemplateColumns: `var(--gantt-label) repeat(${view.days}, minmax(var(--gantt-day), 1fr))` }}
              >
                <div className="font-semibold text-gray-600 sticky left-0 bg-white z-10">İş</div>
                {days.map((d, i) => (
                  <div
                    key={i}
                    className={`text-center ${d.getDay() === 0 || d.getDay() === 6 ? "text-red-400" : ""}`}
                  >
                    {d.getDate()}.{d.getMonth() + 1}
                  </div>
                ))}
              </div>
              {/* Satırlar */}
              {items.map((item) => {
                const span = ganttSpan(item, start, view.days);
                return (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className="grid items-center py-0.5 hover:bg-gray-50"
                    style={{ gridTemplateColumns: `var(--gantt-label) repeat(${view.days}, minmax(var(--gantt-day), 1fr))` }}
                  >
                    {/* Yapışkan etiket sütunu: sağa kaydırırken iş adı görünür kalır. */}
                    <div className="pr-2 min-w-0 sticky left-0 bg-white z-10">
                      <Link href={itemHref(item)} className="text-xs font-medium hover:underline">
                        {item.structureCode} {item.elementName}
                      </Link>
                      <p className="text-[10px] text-gray-500 truncate">
                        {item.workName}
                        {item.crewName ? ` · ${item.crewName}` : ""}
                      </p>
                    </div>
                    {span ? (
                      <>
                        {span.offset > 0 && <div style={{ gridColumn: `span ${span.offset}` }} />}
                        <div
                          style={{ gridColumn: `span ${span.span}` }}
                          className={`h-5 rounded text-[10px] text-white px-1 flex items-center overflow-hidden ${
                            item.isDelayed
                              ? "bg-red-600"
                              : item.status === "TAMAMLANDI"
                                ? "bg-green-600"
                                : item.kind === "POUR"
                                  ? "bg-indigo-600"
                                  : "bg-blue-600"
                          }`}
                          title={`${item.workName} — ${statusLabel(item)}${
                            item.isDelayed ? ` (${item.delayDays} gün gecikme)` : ""
                          }`}
                        >
                          {item.kind === "POUR" ? "Beton" : item.workName}
                        </div>
                      </>
                    ) : (
                      <div
                        style={{ gridColumn: `span ${view.days}` }}
                        className="text-[10px] text-slate-500 pl-1"
                      >
                        Tarih girilmemiş
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3 mt-3 text-[10px] text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-600 inline-block" /> İmalat
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-indigo-600 inline-block" /> Beton
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-600 inline-block" /> Tamamlandı
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-600 inline-block" /> Gecikmiş
            </span>
          </div>
        </Card>
      ) : mode.key === "ekip" ? (
        <div className="space-y-3">
          {groupByCrew(items).map((group) => (
            <Card
              key={group.key}
              title={`${group.label} (${group.items.length} iş)`}
            >
              <ul className="divide-y divide-gray-100">
                {group.items.map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="py-2 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <Link href={itemHref(item)} className="text-sm font-medium hover:underline">
                        {item.structureCode} {item.elementName} — {item.workName}
                      </Link>
                      <p className="text-xs text-gray-500">
                        {item.plannedStart?.toLocaleDateString("tr-TR") ?? UNSPECIFIED} →{" "}
                        {item.plannedEnd?.toLocaleDateString("tr-TR") ?? UNSPECIFIED}
                      </p>
                    </div>
                    {item.isDelayed && <Badge tone="red">{item.delayDays} gün gecikme</Badge>}
                    <StatusBadge status={item.status} labelText={statusLabel(item)} />
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : (
        <Card title={`${view.label} — ${items.length} iş`}>
          <ul className="divide-y divide-gray-100">
            {items.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="py-2 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <Link href={itemHref(item)} className="text-sm font-medium hover:underline">
                    {item.structureCode} {item.elementName} — {item.workName}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {item.plannedStart?.toLocaleDateString("tr-TR") ?? UNSPECIFIED} →{" "}
                    {item.plannedEnd?.toLocaleDateString("tr-TR") ?? UNSPECIFIED}
                  </p>
                  <TeamLine item={item} />
                </div>
                {item.isDelayed && <Badge tone="red">{item.delayDays} gün gecikme</Badge>}
                <StatusBadge status={item.status} labelText={statusLabel(item)} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
