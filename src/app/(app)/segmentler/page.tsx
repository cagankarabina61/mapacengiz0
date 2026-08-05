// Dengeli Konsol modülü (madde 17-19): pier bazlı segment panosu + asimetri uyarısı.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { AKTIF } from "@/lib/archive";
import { compareStructureCodes } from "@/lib/logic/structure-codes";
import { Card, PageTitle, EmptyState, Badge } from "@/components/ui";
import {
  canStartNextSegment,
  checkAsymmetry,
  STEP_LABELS,
  type SegmentStepState,
} from "@/lib/logic/segments";
import { getSegmentGateRule } from "@/lib/services/segments";
import { SegmentBoard, type SegmentView } from "./segment-board";
import type { BalancedCantileverSegment } from "@prisma/client";

export const dynamic = "force-dynamic";

function toStepState(s: BalancedCantileverSegment): SegmentStepState {
  return {
    segmentNumber: s.segmentNumber,
    side: s.side,
    rebarStatus: s.rebarStatus,
    formworkStatus: s.formworkStatus,
    tendonStatus: s.tendonStatus,
    anchorageStatus: s.anchorageStatus,
    embeddedItemsStatus: s.embeddedItemsStatus,
    inspectionStatus: s.inspectionStatus,
    concreteStatus: s.concreteStatus,
    postTensioningStatus: s.postTensioningStatus,
    surveyStatus: s.surveyStatus,
    groutingStatus: s.groutingStatus,
    requiredConcreteStrengthMPa: s.requiredConcreteStrengthMPa
      ? Number(s.requiredConcreteStrengthMPa)
      : null,
    achievedConcreteStrengthMPa: s.achievedConcreteStrengthMPa
      ? Number(s.achievedConcreteStrengthMPa)
      : null,
  };
}

export default async function SegmentlerPage({
  searchParams,
}: {
  searchParams: Promise<{ yapi?: string }>;
}) {
  const { yapi } = await searchParams;

  const [segments, structures] = await Promise.all([
    prisma.balancedCantileverSegment.findMany({
      where: yapi ? { pierElement: { structure: { code: yapi } } } : {},
      include: { pierElement: { include: { structure: true } } },
      orderBy: [{ side: "asc" }, { segmentNumber: "asc" }],
    }),
    // Yalnızca dengeli konsolu olan yapılar listelenir (§56)
    prisma.structure.findMany({
      where: { ...AKTIF, hasBalancedCantilever: true },
      orderBy: { code: "asc" },
    }),
  ]);
  const sortedStructures = [...structures].sort((a, b) => compareStructureCodes(a.code, b.code));

  // Pier bazında grupla
  const byPier = new Map<string, typeof segments>();
  for (const s of segments) {
    const key = s.pierElementId;
    if (!byPier.has(key)) byPier.set(key, []);
    byPier.get(key)!.push(s);
  }

  return (
    <div className="space-y-4">
      <PageTitle>Dengeli Konsol Takibi{yapi ? ` — ${yapi}` : ""}</PageTitle>

      {/* Proje/VIA filtresi (§56) — yalnızca dengeli konsolu olan yapılar */}
      {sortedStructures.length > 0 && (
        <Card>
          <div className="flex gap-2 flex-wrap text-sm">
            <span className="text-gray-500 py-1">Yapı:</span>
            <Link
              href="/segmentler"
              className={`px-2 py-1 rounded ${!yapi ? "bg-blue-700 text-white" : "bg-gray-100"}`}
            >
              Tümü
            </Link>
            {sortedStructures.map((s) => (
              <Link
                key={s.id}
                href={`/segmentler?yapi=${encodeURIComponent(s.code)}`}
                className={`px-2 py-1 rounded ${
                  yapi === s.code ? "bg-blue-700 text-white" : "bg-gray-100"
                }`}
              >
                {s.code}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {byPier.size === 0 ? (
        <Card>
          <EmptyState message="Henüz dengeli konsol segmenti tanımlanmadı." />
        </Card>
      ) : (
        await Promise.all([...byPier.entries()].map(async ([pierId, pierSegments]) => {
          const pier = pierSegments[0].pierElement;
          const stepStates = pierSegments.map(toStepState);
          // Kapı kuralı projeden gelir; tanımlı değilse sistem karar üretmez (madde 5)
          const rule = await getSegmentGateRule(pier.structureId);
          const asymmetry = checkAsymmetry(stepStates, rule);

          const views: SegmentView[] = pierSegments.map((s) => {
            const previous =
              pierSegments.find(
                (p) => p.side === s.side && p.segmentNumber === s.segmentNumber - 1
              ) ?? null;
            const gate = canStartNextSegment(previous ? toStepState(previous) : null, rule);
            return {
              id: s.id,
              code: s.code,
              segmentNumber: s.segmentNumber,
              side: s.side,
              canStart: gate.canStart,
              gateExplanation: gate.explanation,
              missingFromPrevious: gate.missingSteps,
              steps: {
                rebarStatus: s.rebarStatus,
                formworkStatus: s.formworkStatus,
                tendonStatus: s.tendonStatus,
                anchorageStatus: s.anchorageStatus,
                embeddedItemsStatus: s.embeddedItemsStatus,
                inspectionStatus: s.inspectionStatus,
                concreteStatus: s.concreteStatus,
                postTensioningStatus: s.postTensioningStatus,
                surveyStatus: s.surveyStatus,
                groutingStatus: s.groutingStatus,
              },
            };
          });

          return (
            <Card
              key={pierId}
              title={`${pier.structure.code} ${pier.name}`}
            >
              {/* Kural kaynağı şeffaf gösterilir — sistem kendi varsayımını dayatmaz */}
              {rule ? (
                <p className="text-xs text-gray-500 mb-3">
                  Zincir kuralı: {rule.requiredSteps.map((s) => STEP_LABELS[s] ?? s).join(", ")}
                  {rule.requireStrength ? " + gerekli beton dayanımı" : ""} · Asimetri eşiği:{" "}
                  {rule.asymmetryThreshold} segment
                  {rule.note ? ` · Kaynak: ${rule.note}` : ""}
                </p>
              ) : (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
                  Segment başlama kuralı tanımlanmamış. Hangi adımların sonraki segmenti bağladığı
                  proje/Method Statement&apos;a göre girilene kadar sistem zincir kararı üretmez.
                </p>
              )}

              {asymmetry.isUnbalanced === true && (
                <div className="mb-3">
                  <Badge tone="red">
                    Dengesiz İlerleme Uyarısı — Sol: S{asymmetry.leftMax} / Sağ: S
                    {asymmetry.rightMax} (fark {asymmetry.difference}, izin verilen{" "}
                    {asymmetry.threshold})
                  </Badge>
                </div>
              )}
              <SegmentBoard segments={views} />
            </Card>
          );
        }))
      )}
    </div>
  );
}
