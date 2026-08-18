// Ana Dashboard. Ana çıktı sayı değil, aksiyon: "hangi iş hazır değil, neden, ne yapılmalı" (madde 11).
import Link from "next/link";
import { getDashboardCounts, getAttentionItems, getPoursInRange } from "@/lib/services/dashboard";
import { getBlockedActivities } from "@/lib/services/blocking";
import { pourTargetLabel } from "@/lib/services/pours";
import { Card, StatusBadge, LinkButton, EmptyState, Badge } from "@/components/ui";
import { SectionCard } from "@/components/section-card";
import { NoteStrip } from "@/components/notes/note-strip";
import { POUR_STATUS_LABELS, label } from "@/lib/labels";
import { RISK_LEVEL_LABELS, WORK_KIND_LABELS } from "@/lib/logic/risk";
import { evaluatePourReadiness } from "@/lib/logic/readiness";
import { requireSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getSectionNotes } from "@/lib/services/notes";
import { AddAttentionItemButton, ResolveAttentionItemButton } from "./attention-client";

export const dynamic = "force-dynamic";

function Stat({ label, value, tone }: { label: string; value: number; tone?: "red" | "yellow" }) {
  const color =
    tone === "red" ? "text-red-700" : tone === "yellow" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold tabular ${color}`}>{value}</p>
      <p className="text-xs text-muted mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const viewer = { id: session.user.id, role: session.user.role };

  const [counts, attention, poursToday, blocked, canWriteNote, canAddItem, sectionNotes] =
    await Promise.all([
      getDashboardCounts(),
      getAttentionItems(viewer),
      getPoursInRange(0),
      getBlockedActivities(),
      hasPermission(session.user.role, "note", "create"),
      hasPermission(session.user.role, "attentionItem", "create"),
      getSectionNotes(["panel.dikkat", "panel.beton", "panel.bloke"], viewer),
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

      {/* Dikkat listesi — neden + ne yapılmalı + kim (madde 11).
          Sistem ve elle eklenen kalemler AYNI kart biçimini kullanır; ayrım
          yalnızca küçük "Elle" köken etiketiyle yapılır. Sistem kalemlerinde
          gizle/ertele/kapat YOKTUR — yalnızca not eklenebilir. */}
      <SectionCard
        sectionKey="panel.dikkat"
        notes={sectionNotes.get("Section:panel.dikkat") ?? []}
        canWriteNote={canWriteNote}
        actions={canAddItem ? <AddAttentionItemButton /> : undefined}
      >
        {attention.length === 0 ? (
          <EmptyState message="Şu anda kritik uyarı yok." />
        ) : (
          <ul className="space-y-2">
            {attention.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className="border-l-4 border-red-500 bg-red-50/70 ring-1 ring-inset ring-red-100 rounded-lg px-3 py-2.5"
              >
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {item.href ? (
                        <Link href={item.href} className="hover:underline">
                          {item.label}
                        </Link>
                      ) : (
                        item.label
                      )}
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        {item.source === "ELLE"
                          ? "Elle eklendi"
                          : WORK_KIND_LABELS[item.risk.kind]}
                        {item.responsible ? ` · ${item.responsible}` : ""}
                      </span>
                    </p>
                    {item.state && <p className="text-xs text-gray-700 mt-0.5">{item.state}</p>}

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

                    {/* Kullanıcı katmanı: not her kalemde; kapatma YALNIZCA elle kalemde. */}
                    <NoteStrip
                      notes={item.notes}
                      entityType={item.noteEntityType}
                      entityId={item.id}
                      canWrite={canWriteNote}
                      compact
                    />
                    {item.source === "ELLE" && canAddItem && (
                      <ResolveAttentionItemButton itemId={item.id} />
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <Badge tone={item.risk.level === "YUKSEK" ? "red" : "yellow"}>
                      Risk: {RISK_LEVEL_LABELS[item.risk.level]} ({item.risk.score})
                    </Badge>
                    {item.source === "ELLE" && (
                      <p className="mt-1">
                        <Badge tone="blue">Elle</Badge>
                      </p>
                    )}
                    {item.source === "SISTEM" && (
                      <p
                        className="text-[10px] text-gray-500 mt-1"
                        title={item.risk.factors.map((f) => `${f.label}: +${f.points}`).join("\n")}
                      >
                        {item.risk.factors.map((f) => `${f.label} +${f.points}`).join(", ")}
                      </p>
                    )}
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
      </SectionCard>

      {/* Masaüstünde iki sütun — büyük ekranda daha az kaydırma */}
      <div className="grid gap-4 lg:grid-cols-2">
      {/* Bugünün betonları */}
      <SectionCard
        sectionKey="panel.beton"
        notes={sectionNotes.get("Section:panel.beton") ?? []}
        canWriteNote={canWriteNote}
      >
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
      </SectionCard>

      {/* Bloke işler */}
      <SectionCard
        sectionKey="panel.bloke"
        notes={sectionNotes.get("Section:panel.bloke") ?? []}
        canWriteNote={canWriteNote}
      >
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
      </SectionCard>
      </div>
    </div>
  );
}
