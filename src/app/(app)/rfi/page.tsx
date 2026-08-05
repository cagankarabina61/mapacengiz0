// RFI takibi (madde 22-23): liste + oluşturma + durum akışı + etkilenen işler.
import { prisma } from "@/lib/db";
import { AKTIF } from "@/lib/archive";
import { Card, PageTitle, EmptyState, StatusBadge, Badge } from "@/components/ui";
import { RFI_STATUS_LABELS, label } from "@/lib/labels";
import { RFIForm, RFITransitions } from "./rfi-client";

export const dynamic = "force-dynamic";

const PRIORITY_LABELS: Record<string, string> = {
  DUSUK: "Düşük",
  ORTA: "Orta",
  YUKSEK: "Yüksek",
  KRITIK: "Kritik",
};

export default async function RFIPage() {
  const [rfis, structures] = await Promise.all([
    prisma.rFI.findMany({
      include: {
        structure: true,
        element: true,
        affectedActivities: {
          include: { activity: { include: { element: true } } },
        },
      },
      orderBy: [{ status: "asc" }, { date: "desc" }],
      take: 100,
    }),
    prisma.structure.findMany({
      where: AKTIF,
      include: {
        elements: {
          where: AKTIF,
          orderBy: { code: "asc" },
          include: { activities: { where: { status: { notIn: ["TAMAMLANDI", "IPTAL"] } } } },
        },
      },
      orderBy: { code: "asc" },
    }),
  ]);

  const openCount = rfis.filter(
    (r) => r.status !== "CEVAPLANDI" && r.status !== "KAPATILDI"
  ).length;

  return (
    <div className="space-y-4">
      <PageTitle>
        RFI Takibi{" "}
        {openCount > 0 && (
          <span className="ml-2">
            <Badge tone="yellow">{openCount} açık</Badge>
          </span>
        )}
      </PageTitle>

      <Card title="Yeni RFI">
        <RFIForm
          structures={structures.map((s) => ({
            id: s.id,
            code: s.code,
            elements: s.elements.map((e) => ({ id: e.id, code: e.code, name: e.name })),
            activities: s.elements.flatMap((e) =>
              e.activities.map((a) => ({ id: a.id, label: `${e.name} — ${a.name}` }))
            ),
          }))}
        />
      </Card>

      {rfis.length === 0 ? (
        <Card>
          <EmptyState message="Kayıtlı RFI yok." />
        </Card>
      ) : (
        rfis.map((rfi) => (
          <Card key={rfi.id}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">
                  {rfi.rfiNumber} — {rfi.subject}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {rfi.structure.code}
                  {rfi.element ? ` ${rfi.element.name}` : ""} · Öncelik:{" "}
                  {label(PRIORITY_LABELS, rfi.priority)} · Tarih:{" "}
                  {rfi.date.toLocaleDateString("tr-TR")}
                  {rfi.submittedDate
                    ? ` · Gönderim: ${rfi.submittedDate.toLocaleDateString("tr-TR")}`
                    : ""}
                  {rfi.answeredDate
                    ? ` · Cevap: ${rfi.answeredDate.toLocaleDateString("tr-TR")}`
                    : ""}
                </p>
                {rfi.description && (
                  <p className="text-sm text-gray-700 mt-1">{rfi.description}</p>
                )}
                {rfi.affectedActivities.length > 0 && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {rfi.affectedActivities.map((aa) => (
                      <Badge key={aa.id} tone="red">
                        Bloke: {aa.activity.element.name} — {aa.activity.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0 space-y-2 text-right">
                <StatusBadge status={rfi.status} labelText={label(RFI_STATUS_LABELS, rfi.status)} />
                <RFITransitions rfiId={rfi.id} status={rfi.status} />
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
