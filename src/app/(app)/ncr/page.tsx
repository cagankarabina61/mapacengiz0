// NCR modülü (madde 25): liste + oluşturma + durum akışı (Açık → Düzeltme → Kapatıldı).
import { prisma } from "@/lib/db";
import { AKTIF } from "@/lib/archive";
import { Card, PageTitle, EmptyState, StatusBadge, Badge } from "@/components/ui";
import { NCR_STATUS_LABELS, NCR_IMPACT_LABELS, label } from "@/lib/labels";
import { NCRForm, NCRStatusPanel } from "./ncr-client";

export const dynamic = "force-dynamic";

export default async function NCRPage() {
  const [ncrs, structures, users] = await Promise.all([
    prisma.nCR.findMany({
      include: { structure: true, element: true },
      orderBy: [{ status: "asc" }, { date: "desc" }],
      take: 100,
    }),
    prisma.structure.findMany({
      where: AKTIF,
      include: { elements: { where: AKTIF, orderBy: { code: "asc" } } },
      orderBy: { code: "asc" },
    }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const openCount = ncrs.filter((n) => n.status !== "KAPATILDI").length;

  return (
    <div className="space-y-4">
      <PageTitle>
        NCR — Uygunsuzluk Raporları{" "}
        {openCount > 0 && (
          <span className="ml-2">
            <Badge tone="red">{openCount} açık</Badge>
          </span>
        )}
      </PageTitle>

      <Card title="Yeni NCR">
        <NCRForm
          structures={structures.map((s) => ({
            id: s.id,
            code: s.code,
            elements: s.elements.map((e) => ({ id: e.id, code: e.code, name: e.name })),
          }))}
          users={users.map((u) => ({ id: u.id, name: u.name }))}
        />
      </Card>

      {ncrs.length === 0 ? (
        <Card>
          <EmptyState message="Kayıtlı NCR yok." />
        </Card>
      ) : (
        ncrs.map((ncr) => (
          <Card key={ncr.id}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">
                  {ncr.ncrNumber} — {ncr.structure.code}
                  {ncr.element ? ` ${ncr.element.name}` : ""}
                </p>
                <p className="text-sm text-gray-700 mt-1">{ncr.problemDescription}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Tarih: {ncr.date.toLocaleDateString("tr-TR")}
                  {ncr.responsibleUserId
                    ? ` · Sorumlu: ${userMap.get(ncr.responsibleUserId) ?? "?"}`
                    : ""}
                  {ncr.dueDate ? ` · Son tarih: ${ncr.dueDate.toLocaleDateString("tr-TR")}` : ""}
                  {ncr.closedDate
                    ? ` · Kapanış: ${ncr.closedDate.toLocaleDateString("tr-TR")}`
                    : ""}
                </p>
                {ncr.correctiveAction && (
                  <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded px-2 py-1">
                    Düzeltici faaliyet: {ncr.correctiveAction}
                  </p>
                )}
              </div>
              <div className="shrink-0 space-y-2 text-right">
                <div className="flex gap-1 justify-end flex-wrap">
                  <StatusBadge status={ncr.impact} labelText={label(NCR_IMPACT_LABELS, ncr.impact)} />
                  <StatusBadge status={ncr.status} labelText={label(NCR_STATUS_LABELS, ncr.status)} />
                </div>
                <NCRStatusPanel
                  ncrId={ncr.id}
                  status={ncr.status}
                  hasCorrectiveAction={!!ncr.correctiveAction}
                />
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
