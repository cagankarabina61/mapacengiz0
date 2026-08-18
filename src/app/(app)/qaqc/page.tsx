// QA/QC modülü (madde 24): eleman bazında ITP kontrol noktaları ve sonuç girişi.
import { prisma } from "@/lib/db";
import { AKTIF } from "@/lib/archive";
import { Card, PageTitle, EmptyState, StatusBadge, Badge } from "@/components/ui";
import { label } from "@/lib/labels";
import { InspectionButtons } from "./inspection-panel";

export const dynamic = "force-dynamic";

const CHECKPOINT_TYPE_LABELS: Record<string, string> = {
  HOLD_POINT: "Hold Point",
  WITNESS_POINT: "Witness Point",
  REVIEW: "Review",
  INSPECTION: "Inspection",
};

const RESULT_LABELS: Record<string, string> = {
  BEKLIYOR: "Bekliyor",
  GECTI: "Geçti",
  KALDI: "Kaldı",
  SARTLI_GECTI: "Şartlı Geçti",
};

export default async function QaqcPage() {
  // ITP şablonu olan eleman tipleri ve o tipteki elemanlar
  const templates = await prisma.iTPTemplate.findMany({
    include: { checkpoints: { orderBy: { sequenceOrder: "asc" } } },
  });
  const elementTypes = templates.map((t) => t.elementType);
  const elements = await prisma.structureElement.findMany({
    where: { ...AKTIF, elementType: { in: elementTypes } },
    include: { structure: true, inspections: { include: { checkpoint: true } } },
    orderBy: { code: "asc" },
  });

  return (
    <div className="space-y-4">
      <PageTitle>QA/QC — ITP Kontrolleri</PageTitle>

      {elements.length === 0 ? (
        <Card>
          <EmptyState message="ITP şablonu tanımlı eleman bulunamadı." />
        </Card>
      ) : (
        elements.map((el) => {
          const template = templates.find((t) => t.elementType === el.elementType);
          if (!template) return null;
          const holdPointsPending = template.checkpoints.filter((cp) => {
            if (cp.checkpointType !== "HOLD_POINT") return false;
            const insp = el.inspections.find((i) => i.checkpointId === cp.id);
            return !insp || (insp.result !== "GECTI" && insp.result !== "SARTLI_GECTI");
          }).length;

          return (
            <Card key={el.id}>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div>
                  <p className="font-semibold text-sm">
                    {el.structure.code} {el.name}
                    <span className="text-xs text-slate-500 font-normal ml-2">({el.code})</span>
                  </p>
                  <p className="text-xs text-gray-500">{template.name}</p>
                </div>
                {holdPointsPending > 0 ? (
                  <Badge tone="red">{holdPointsPending} Hold Point serbest değil</Badge>
                ) : (
                  <Badge tone="green">Tüm Hold Point&apos;ler serbest</Badge>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-300 text-left">
                      <th className="py-2 px-2 font-semibold text-gray-600">#</th>
                      <th className="py-2 px-2 font-semibold text-gray-600">Kontrol Noktası</th>
                      <th className="py-2 px-2 font-semibold text-gray-600">Tip</th>
                      <th className="py-2 px-2 font-semibold text-gray-600">Sonuç</th>
                      <th className="py-2 px-2 font-semibold text-gray-600">Kontrol Eden</th>
                      <th className="py-2 px-2 font-semibold text-gray-600">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {template.checkpoints.map((cp) => {
                      const insp = el.inspections.find((i) => i.checkpointId === cp.id);
                      const result = insp?.result ?? "BEKLIYOR";
                      return (
                        <tr key={cp.id}>
                          <td className="py-2 px-2 text-slate-500">{cp.sequenceOrder}</td>
                          <td className="py-2 px-2 font-medium">{cp.name}</td>
                          <td className="py-2 px-2">
                            <Badge tone={cp.checkpointType === "HOLD_POINT" ? "red" : "gray"}>
                              {label(CHECKPOINT_TYPE_LABELS, cp.checkpointType)}
                            </Badge>
                          </td>
                          <td className="py-2 px-2">
                            <StatusBadge status={result} labelText={label(RESULT_LABELS, result)} />
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-500">
                            {insp?.inspectedAt
                              ? `${insp.inspectedAt.toLocaleDateString("tr-TR")}`
                              : "—"}
                          </td>
                          <td className="py-2 px-2">
                            <InspectionButtons
                              checkpointId={cp.id}
                              elementId={el.id}
                              currentResult={result}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
