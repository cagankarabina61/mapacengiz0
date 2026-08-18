// Çizim revizyon takibi (madde 21): onaylı revizyon vs sahada kullanılan revizyon.
import { prisma } from "@/lib/db";
import { AKTIF } from "@/lib/archive";
import { Card, PageTitle, EmptyState, StatusBadge, Badge } from "@/components/ui";
import { label } from "@/lib/labels";
import {
  DrawingForm,
  AddRevisionForm,
  RevisionStatusButtons,
  SiteUsedForm,
} from "./drawing-client";

export const dynamic = "force-dynamic";

const REVISION_STATUS_LABELS: Record<string, string> = {
  TASLAK: "Taslak",
  INCELEMEDE: "İncelemede",
  ONAYLI: "Onaylı",
  REDDEDILDI: "Reddedildi",
  SUPERSEDED: "Geçersiz (Yeni Rev. Var)",
};

const DRAWING_TYPE_LABELS: Record<string, string> = {
  IFC: "IFC",
  SHOP_DRAWING: "Shop Drawing",
  DIGER: "Diğer",
};

export default async function CizimlerPage() {
  const [drawings, structures] = await Promise.all([
    prisma.drawing.findMany({
      include: {
        structure: true,
        element: true,
        revisions: { orderBy: { revisionCode: "desc" } },
        usages: { include: { siteUsedRevision: true, element: true } },
      },
      orderBy: { code: "asc" },
    }),
    prisma.structure.findMany({
      where: AKTIF,
      include: { elements: { where: AKTIF, orderBy: { code: "asc" } } },
      orderBy: { code: "asc" },
    }),
  ]);

  // Kritik uyarılar: sahada kullanılan ≠ son onaylı (madde 21)
  const mismatches = drawings.flatMap((d) => {
    const approved = d.revisions.find((r) => r.status === "ONAYLI");
    if (!approved) return [];
    return d.usages
      .filter((u) => u.siteUsedRevisionId !== approved.id)
      .map((u) => ({
        drawing: d,
        approved,
        usage: u,
      }));
  });

  return (
    <div className="space-y-4">
      <PageTitle>Çizimler ve Revizyonlar</PageTitle>

      {mismatches.length > 0 && (
        <Card>
          {mismatches.map((m, i) => (
            <p
              key={i}
              className="text-sm text-red-900 bg-red-50 border border-red-300 rounded px-3 py-2 mb-1 font-medium"
            >
              KRİTİK UYARI — {m.drawing.code} ({m.usage.element.name}): Şantiyede kullanılan çizim (
              {m.usage.siteUsedRevision.revisionCode}), son onaylı revizyondan (
              {m.approved.revisionCode}) farklıdır.
            </p>
          ))}
        </Card>
      )}

      <Card title="Yeni Çizim">
        <DrawingForm
          structures={structures.map((s) => ({
            id: s.id,
            code: s.code,
            elements: s.elements.map((e) => ({ id: e.id, code: e.code, name: e.name })),
          }))}
        />
      </Card>

      {drawings.length === 0 ? (
        <Card>
          <EmptyState message="Kayıtlı çizim yok." />
        </Card>
      ) : (
        drawings.map((d) => {
          const approved = d.revisions.find((r) => r.status === "ONAYLI");
          return (
            <Card key={d.id}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-sm">
                    {d.code} — {d.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {d.structure.code}
                    {d.element ? ` ${d.element.name}` : ""} ·{" "}
                    {label(DRAWING_TYPE_LABELS, d.drawingType)}
                  </p>
                </div>
                {approved ? (
                  <Badge tone="green">Onaylı: {approved.revisionCode}</Badge>
                ) : (
                  <Badge tone="yellow">Onaylı revizyon yok</Badge>
                )}
              </div>

              {/* Revizyonlar */}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-300 text-left">
                      <th className="py-1.5 px-2 font-semibold text-gray-600">Revizyon</th>
                      <th className="py-1.5 px-2 font-semibold text-gray-600">Durum</th>
                      <th className="py-1.5 px-2 font-semibold text-gray-600">Onay Tarihi</th>
                      <th className="py-1.5 px-2 font-semibold text-gray-600">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {d.revisions.map((r) => (
                      <tr key={r.id}>
                        <td className="py-1.5 px-2 font-medium">{r.revisionCode}</td>
                        <td className="py-1.5 px-2">
                          <StatusBadge
                            status={r.status}
                            labelText={label(REVISION_STATUS_LABELS, r.status)}
                          />
                        </td>
                        <td className="py-1.5 px-2 text-xs text-gray-500">
                          {r.approvedDate?.toLocaleDateString("tr-TR") ?? "—"}
                        </td>
                        <td className="py-1.5 px-2">
                          <RevisionStatusButtons revisionId={r.id} status={r.status} />
                        </td>
                      </tr>
                    ))}
                    {d.revisions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-2 px-2 text-xs text-slate-500">
                          Henüz revizyon yok.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100">
                <AddRevisionForm drawingId={d.id} />
              </div>

              {/* Sahada kullanılan revizyon (madde 21) */}
              {d.element && d.revisions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap text-sm">
                  <span className="text-gray-600">
                    Sahada kullanılan revizyon ({d.element.name}):
                  </span>
                  <SiteUsedForm
                    elementId={d.element.id}
                    drawingId={d.id}
                    revisions={d.revisions.map((r) => ({ id: r.id, code: r.revisionCode }))}
                    currentRevisionId={
                      d.usages.find((u) => u.elementId === d.element!.id)?.siteUsedRevisionId ?? null
                    }
                  />
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
