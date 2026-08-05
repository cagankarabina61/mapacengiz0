// Ana Dashboard. Ana çıktı sayı değil, aksiyon: "hangi iş hazır değil, neden, ne yapılmalı" (madde 11).
import Link from "next/link";
import { getDashboardCounts, getAttentionItems, getPoursInRange } from "@/lib/services/dashboard";
import { getBlockedActivities } from "@/lib/services/blocking";
import { pourTargetLabel } from "@/lib/services/pours";
import { Card, StatusBadge, LinkButton, EmptyState, Badge } from "@/components/ui";
import { POUR_STATUS_LABELS, label } from "@/lib/labels";
import { RISK_LEVEL_LABELS, WORK_KIND_LABELS } from "@/lib/logic/risk";
import { evaluatePourReadiness } from "@/lib/logic/readiness";

export const dynamic = "force-dynamic";

function Stat({ label, value, tone }: { label: string; value: number; tone?: "red" | "yellow" }) {
  const color =
    tone === "red" ? "text-red-700" : tone === "yellow" ? "text-amber-700" : "text-gray-900";
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const [counts, attention, poursToday, blocked] = await Promise.all([
    getDashboardCounts(),
    getAttentionItems(),
    getPoursInRange(0),
    getBlockedActivities(),
  ]);

  const trulyBlocked = blocked.filter((b) => !b.canStart);

  return (
    <div className="space-y-4">
      {/* Hızlı işlemler */}
      <div className="flex gap-2 flex-wrap">
        <LinkButton href="/beton/yeni">+ Beton Dökümü</LinkButton>
        <LinkButton href="/planlama" variant="secondary">
          Planlama (3 Hafta)
        </LinkButton>
        <LinkButton href="/bugun?mod=ekip" variant="secondary">
          Bugün — Ekip Bazlı
        </LinkButton>
      </div>

      {/* Sayaçlar */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <Card>
          <Stat label="Bugün Beton" value={counts.poursToday} />
        </Card>
        <Card>
          <Stat label="Yarın Beton" value={counts.poursTomorrow} />
        </Card>
        <Card>
          <Stat label="Kontrol Bekleyen" value={counts.inspectionsPending} tone="yellow" />
        </Card>
        <Card>
          <Stat
            label="Bloke İş"
            value={trulyBlocked.length}
            tone={trulyBlocked.length > 0 ? "red" : undefined}
          />
        </Card>
        <Card>
          <Stat
            label="Gecikmiş"
            value={counts.delayedCount}
            tone={counts.delayedCount > 0 ? "red" : undefined}
          />
        </Card>
        <Card>
          <Stat label="Aktif Yapı" value={counts.activeStructures} />
        </Card>
      </div>

      {/* Dikkat listesi — neden + ne yapılmalı + kim (madde 11) */}
      <Card title="Bugün Dikkat Gerektiren İşler">
        {attention.length === 0 ? (
          <EmptyState message="Şu anda kritik uyarı yok." />
        ) : (
          <ul className="space-y-2">
            {attention.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className="border-l-4 border-red-400 bg-red-50 rounded px-3 py-2"
              >
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {item.kind === "POUR" ? (
                        <Link href={`/beton/${item.code}`} className="hover:underline">
                          {item.label}
                        </Link>
                      ) : (
                        <Link
                          href={`/yapilar/${item.structureCode}`}
                          className="hover:underline"
                        >
                          {item.label}
                        </Link>
                      )}
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        {WORK_KIND_LABELS[item.risk.kind]}
                        {item.responsible ? ` · ${item.responsible}` : ""}
                      </span>
                    </p>
                    <p className="text-xs text-gray-700 mt-0.5">{item.state}</p>

                    {item.reasons.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-gray-600 mt-1">Neden:</p>
                        <ul className="text-xs text-gray-600 list-disc ml-4">
                          {item.reasons.slice(0, 4).map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {item.nextActions.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-gray-600 mt-1">
                          Ne yapılırsa hazır olur:
                        </p>
                        <ul className="text-xs text-blue-900 list-disc ml-4">
                          {item.nextActions.slice(0, 3).map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <Badge tone={item.risk.level === "YUKSEK" ? "red" : "yellow"}>
                      Risk: {RISK_LEVEL_LABELS[item.risk.level]} ({item.risk.score})
                    </Badge>
                    <p
                      className="text-[10px] text-gray-500 mt-1"
                      title={item.risk.factors.map((f) => `${f.label}: +${f.points}`).join("\n")}
                    >
                      {item.risk.factors.map((f) => `${f.label} +${f.points}`).join(", ")}
                    </p>
                    {item.plannedDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        {item.plannedDate.toLocaleDateString("tr-TR")}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Bugünün betonları */}
      <Card title="Bugünün Betonları">
        {poursToday.length === 0 ? (
          <EmptyState message="Bugün planlanmış beton dökümü yok." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {poursToday.map((pour) => {
              const readiness = evaluatePourReadiness({
                checklistItems: pour.checklistItems,
                isOverride: pour.isOverride,
                overrideReason: pour.overrideReason,
              });
              return (
                <li key={pour.id} className="py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/beton/${pour.code}`} className="text-sm font-medium hover:underline">
                      {pourTargetLabel(pour)}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {pour.plannedTime ?? "Saat belirtilmemiş"} ·{" "}
                      {pour.plannedVolumeM3.toString()} m³ ·{" "}
                      {pour.concreteClass ?? "Beton sınıfı belirtilmemiş"}
                      {pour.responsibleUser ? ` · ${pour.responsibleUser.name}` : ""}
                    </p>
                  </div>
                  {readiness.isReady ? (
                    <StatusBadge
                      status="BETON_DOKUMUNE_HAZIR"
                      labelText={readiness.viaOverride ? "Hazır (Override)" : "İmalata Hazır"}
                    />
                  ) : (
                    <StatusBadge status={pour.status} labelText={label(POUR_STATUS_LABELS, pour.status)} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Bloke işler */}
      <Card title="Bloke İşler">
        {trulyBlocked.length === 0 ? (
          <EmptyState message="Bloke iş yok." />
        ) : (
          <ul className="space-y-2">
            {trulyBlocked.slice(0, 5).map(({ activity, reasons, nextActions }) => (
              <li key={activity.id} className="text-sm border-l-4 border-red-400 pl-3 py-1">
                <p className="font-medium">
                  {activity.element.structure.code} {activity.element.name} — {activity.name}
                </p>
                <p className="text-xs text-gray-600">
                  {reasons[0]?.message} Sorumlu: {reasons[0]?.responsible}
                </p>
                {nextActions[0] && (
                  <p className="text-xs text-blue-900">Sonraki işlem: {nextActions[0]}</p>
                )}
              </li>
            ))}
            {trulyBlocked.length > 5 && (
              <li>
                <Link href="/bloke" className="text-sm text-blue-700 hover:underline">
                  Tümünü gör ({trulyBlocked.length})
                </Link>
              </li>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}
