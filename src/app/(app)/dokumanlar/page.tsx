// Doküman yönetimi (madde 50-51): yükleme + otomatik eşleştirme önerisi + liste.
import { prisma } from "@/lib/db";
import { AKTIF } from "@/lib/archive";
import { Card, PageTitle, EmptyState, Badge, Table } from "@/components/ui";
import { UploadForm, type EntityOption } from "./upload-client";

export const dynamic = "force-dynamic";

const FILE_TYPE_LABELS: Record<string, string> = {
  FOTOGRAF: "Fotoğraf",
  PDF: "PDF",
  EXCEL: "Excel",
  DIGER: "Diğer",
};

export default async function DokumanlarPage() {
  const [attachments, structures, elements, ncrs, rfis, users] = await Promise.all([
    prisma.attachment.findMany({
      include: { uploadedBy: true },
      orderBy: { uploadedAt: "desc" },
      take: 100,
    }),
    prisma.structure.findMany({ where: AKTIF, orderBy: { code: "asc" } }),
    prisma.structureElement.findMany({
      where: AKTIF,
      include: { structure: true },
      orderBy: { code: "asc" },
    }),
    prisma.nCR.findMany({ orderBy: { ncrNumber: "asc" } }),
    prisma.rFI.findMany({ orderBy: { rfiNumber: "asc" } }),
    prisma.user.findMany(),
  ]);

  const entities: EntityOption[] = [
    ...structures.map((s) => ({
      entityType: "Structure",
      entityId: s.id,
      label: `Yapı: ${s.code}`,
      structureCode: s.code,
      elementCode: null,
    })),
    ...elements.map((e) => ({
      entityType: "StructureElement",
      entityId: e.id,
      label: `Eleman: ${e.structure.code} ${e.name} (${e.code})`,
      structureCode: e.structure.code,
      elementCode: e.code,
    })),
    ...ncrs.map((n) => ({
      entityType: "NCR",
      entityId: n.id,
      label: `NCR: ${n.ncrNumber}`,
      structureCode: null,
      elementCode: null,
    })),
    ...rfis.map((r) => ({
      entityType: "RFI",
      entityId: r.id,
      label: `RFI: ${r.rfiNumber}`,
      structureCode: null,
      elementCode: null,
    })),
  ];

  // Liste görünümünde entity etiketini çöz
  const entityLabel = (entityType: string, entityId: string) =>
    entities.find((en) => en.entityType === entityType && en.entityId === entityId)?.label ??
    `${entityType}`;

  return (
    <div className="space-y-4">
      <PageTitle>Dokümanlar</PageTitle>

      <Card title="Doküman Yükle">
        <UploadForm entities={entities} structureCodes={structures.map((s) => s.code)} />
      </Card>

      <Card title="Yüklenen Dokümanlar">
        {attachments.length === 0 ? (
          <EmptyState message="Henüz doküman yüklenmedi." />
        ) : (
          <Table headers={["Dosya", "Tür", "Bağlı Kayıt", "Yükleyen", "Tarih"]}>
            {attachments.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="py-2 px-2">
                  <a
                    href={`/api/dosya/${a.id}`}
                    target="_blank"
                    className="text-blue-700 hover:underline font-medium"
                  >
                    {a.fileName}
                  </a>
                </td>
                <td className="py-2 px-2">
                  <Badge tone="gray">{FILE_TYPE_LABELS[a.fileType] ?? a.fileType}</Badge>
                </td>
                <td className="py-2 px-2 text-gray-600">{entityLabel(a.entityType, a.entityId)}</td>
                <td className="py-2 px-2 text-gray-600">{a.uploadedBy.name}</td>
                <td className="py-2 px-2 text-gray-500 text-xs">
                  {a.uploadedAt.toLocaleString("tr-TR")}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
