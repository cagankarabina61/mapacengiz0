// Beton dökümü detayı: hazırlık kapısı + çakışma uyarıları + override + durum geçişleri.
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { evaluatePourReadiness } from "@/lib/logic/readiness";
import { getPourConflicts, pourTargetLabel } from "@/lib/services/pours";
import { Card, PageTitle, StatusBadge, Badge } from "@/components/ui";
import { POUR_STATUS_LABELS, UNSPECIFIED, label } from "@/lib/labels";
import {
  ChecklistPanel,
  OverridePanel,
  TransitionPanel,
  ConflictOverridePanel,
} from "./pour-detail-client";
import { CONFLICT_SEVERITY_LABELS } from "@/lib/logic/resources";
import { formatDuration } from "@/lib/logic/pour-planning";
import { getPourReadinessDetail } from "@/lib/services/readiness";

export const dynamic = "force-dynamic";

export default async function BetonDetayPage({ params }: { params: Promise<{ kod: string }> }) {
  const { kod } = await params;
  const session = await requireSession();

  const pour = await prisma.concretePour.findUnique({
    where: { code: decodeURIComponent(kod) },
    include: {
      pile: true,
      structureElement: { include: { structure: true } },
      segment: true,
      pumpResource: true,
      crewResource: true,
      checklistItems: { include: { checkedBy: true }, orderBy: { itemKey: "asc" } },
      overrideBy: true,
      testSamples: true,
      responsibleUser: true,
      bookings: { include: { conflictOverrideBy: true } },
    },
  });
  if (!pour) notFound();

  const readiness = evaluatePourReadiness({
    checklistItems: pour.checklistItems,
    isOverride: pour.isOverride,
    overrideReason: pour.overrideReason,
  });
  const [conflicts, detail] = await Promise.all([
    getPourConflicts(pour),
    getPourReadinessDetail(pour.id),
  ]);
  const canOverride = await hasPermission(session.user.role, "pourOverride", "create");
  const canOverrideConflict = await hasPermission(session.user.role, "resourceBooking", "update");
  const criticalConflicts = conflicts.filter((c) => c.severity === "KRITIK" && !c.overridden);
  const acceptedConflict = pour.bookings.find((b) => b.conflictOverride);

  const checklistTemplate = await prisma.checklistTemplateItem.findMany({
    orderBy: { sequenceOrder: "asc" },
  });
  const orderMap = new Map(checklistTemplate.map((t) => [t.itemKey, t.sequenceOrder]));
  const sortedItems = [...pour.checklistItems].sort(
    (a, b) => (orderMap.get(a.itemKey) ?? 99) - (orderMap.get(b.itemKey) ?? 99)
  );

  return (
    <div className="space-y-4">
      <PageTitle>
        {pourTargetLabel(pour)} — {pour.code}
      </PageTitle>

      {/* Durum ve uyarı bandı */}
      <div className="flex items-center gap-2 flex-wrap">
        {pour.status === "TAMAMLANDI" || pour.status === "BETON_DOKULUYOR" ? (
          <StatusBadge status={pour.status} labelText={label(POUR_STATUS_LABELS, pour.status)} />
        ) : readiness.isReady ? (
          <StatusBadge
            status="BETON_DOKUMUNE_HAZIR"
            labelText={readiness.viaOverride ? "Hazır (Override)" : "Beton Dökümüne Hazır"}
          />
        ) : (
          <Badge tone="yellow">Hazır Değil — {readiness.missingItems.length} ön koşul eksik</Badge>
        )}
        {pour.isOverride && (
          <Badge tone="red">
            Override: {pour.overrideBy?.name ?? "?"} —{" "}
            {pour.overrideAt?.toLocaleString("tr-TR") ?? ""}
          </Badge>
        )}
      </div>

      {/* Neden hazır değil + ne yapılmalı (madde 11) */}
      {(detail.reasons.length > 0 || detail.nextActions.length > 0) && (
        <Card title="Durum Değerlendirmesi">
          <p className="text-sm text-gray-700">{detail.summary}</p>
          {detail.reasons.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-gray-600">Neden:</p>
              <ul className="text-sm text-gray-700 list-disc ml-5">
                {detail.reasons.map((r, i) => (
                  <li key={i}>
                    [{r.level === "BLOKAJ" ? "Blokaj" : "Uyarı"}] {r.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {detail.nextActions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-gray-600">Ne yapılırsa hazır olur:</p>
              <ol className="text-sm text-blue-900 list-decimal ml-5">
                {detail.nextActions.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ol>
            </div>
          )}
        </Card>
      )}

      {/* Kaynak çakışmaları — seviyelendirilmiş (madde 4) */}
      {conflicts.length > 0 && (
        <Card title="Kaynak Çakışmaları">
          {conflicts.map((c, i) => (
            <div
              key={i}
              className={`text-sm rounded px-3 py-2 mb-1 border ${
                c.overridden
                  ? "bg-gray-50 border-gray-200 text-gray-600"
                  : c.severity === "KRITIK"
                    ? "bg-red-50 border-red-300 text-red-900"
                    : c.severity === "UYARI"
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-gray-50 border-gray-200 text-gray-700"
              }`}
            >
              <span className="font-semibold">[{CONFLICT_SEVERITY_LABELS[c.severity]}]</span>{" "}
              {c.message}
              {c.overridden && <span className="ml-1 font-medium">— kabul edildi</span>}
            </div>
          ))}

          {acceptedConflict && (
            <p className="text-xs text-gray-600 mt-2 bg-gray-50 border border-gray-200 rounded px-3 py-2">
              Çakışma kabulü: {acceptedConflict.conflictOverrideBy?.name ?? "?"} —{" "}
              {acceptedConflict.conflictOverrideAt?.toLocaleString("tr-TR") ?? ""} · Gerekçe:{" "}
              {acceptedConflict.conflictOverrideReason}
            </p>
          )}

          {criticalConflicts.length > 0 && canOverrideConflict && (
            <ConflictOverridePanel pourId={pour.id} />
          )}
          {criticalConflicts.length > 0 && !canOverrideConflict && (
            <p className="text-xs text-gray-600 mt-2">
              Kritik çakışmayı kabul etme yetkisi yalnızca planlama yetkisi olan kullanıcılardadır.
            </p>
          )}
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Döküm Bilgileri">
          <dl className="text-sm space-y-2">
            <div className="flex justify-between">
              <dt className="text-gray-500">Tarih</dt>
              <dd className="font-medium">
                {pour.plannedDate.toLocaleDateString("tr-TR")} {pour.plannedTime ?? ""}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Beton Sınıfı</dt>
              <dd className="font-medium">{pour.concreteClass ?? UNSPECIFIED}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Planlanan Hacim</dt>
              <dd className="font-medium">{pour.plannedVolumeM3.toString()} m³</dd>
            </div>
            {pour.actualVolumeM3 && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Gerçekleşen Hacim</dt>
                <dd className="font-medium">
                  {pour.actualVolumeM3.toString()} m³{" "}
                  <span className="text-xs text-gray-500">
                    (fark: {(Number(pour.actualVolumeM3) - Number(pour.plannedVolumeM3)).toFixed(1)} m³)
                  </span>
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Tahmini Döküm Süresi</dt>
              <dd className="font-medium">
                {formatDuration(pour.estimatedDurationMin)}
                {pour.durationOverridden && (
                  <span className="text-xs text-gray-500"> (elle girildi)</span>
                )}
              </dd>
            </div>
            {pour.plannedEndTime && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Planlanan Bitiş</dt>
                <dd className="font-medium">
                  {pour.plannedEndTime.toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Pompa</dt>
              <dd className="font-medium">{pour.pumpResource?.code ?? UNSPECIFIED}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Ekip</dt>
              <dd className="font-medium">{pour.crewResource?.name ?? UNSPECIFIED}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Sorumlu Mühendis</dt>
              <dd className="font-medium">{pour.responsibleUser?.name ?? UNSPECIFIED}</dd>
            </div>
            {pour.pourStart && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Döküm Başlangıç</dt>
                <dd className="font-medium">{pour.pourStart.toLocaleString("tr-TR")}</dd>
              </div>
            )}
            {pour.pourEnd && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Döküm Bitiş</dt>
                <dd className="font-medium">{pour.pourEnd.toLocaleString("tr-TR")}</dd>
              </div>
            )}
          </dl>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <TransitionPanel pourId={pour.id} status={pour.status} isReady={readiness.isReady} />
          </div>
        </Card>

        <Card title="Beton Döküm Kontrol Listesi">
          <ChecklistPanel
            items={sortedItems.map((i) => ({
              id: i.id,
              label: i.label,
              isChecked: i.isChecked,
              checkedByName: i.checkedBy?.name ?? null,
              checkedAt: i.checkedAt?.toLocaleDateString("tr-TR") ?? null,
            }))}
          />
          {!readiness.isReady && canOverride && pour.status !== "TAMAMLANDI" && (
            <div className="mt-4 pt-4 border-t border-amber-200 bg-amber-50 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
              <OverridePanel pourId={pour.id} />
            </div>
          )}
          {pour.isOverride && pour.overrideReason && (
            <p className="mt-3 text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Override gerekçesi: {pour.overrideReason}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
