// Yapı listesi (§43/§59): yeni yapı ekleme, hızlı arama, filtre, doğal sıralama.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { AKTIF } from "@/lib/archive";
import {
  Card,
  PageTitle,
  Table,
  StatusBadge,
  Badge,
  EmptyState,
  Chip,
  Chips,
  inputClass,
  buttonPrimary,
} from "@/components/ui";
import { SectionCard } from "@/components/section-card";
import { STRUCTURE_TYPE_LABELS, label } from "@/lib/labels";
import { compareStructureCodes } from "@/lib/logic/structure-codes";
import { NewStructureForm } from "./structure-form";
import { requireSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getSectionNotes } from "@/lib/services/notes";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "aktif", label: "Aktif" },
  { key: "dk", label: "Dengeli Konsollu" },
  { key: "arsiv", label: "Arşivli" },
  { key: "tumu", label: "Tümü" },
] as const;

export default async function YapilarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtre?: string }>;
}) {
  const { q, filtre } = await searchParams;
  const activeFilter = FILTERS.find((f) => f.key === filtre) ?? FILTERS[0];
  const query = (q ?? "").trim();

  const session = await requireSession();
  const viewer = { id: session.user.id, role: session.user.role };
  const [canWriteNote, sectionNotes] = await Promise.all([
    hasPermission(session.user.role, "note", "create"),
    getSectionNotes(["yapilar.liste"], viewer),
  ]);

  const where = {
    ...(activeFilter.key === "aktif" ? AKTIF : {}),
    ...(activeFilter.key === "dk" ? { ...AKTIF, hasBalancedCantilever: true } : {}),
    ...(activeFilter.key === "arsiv" ? { NOT: AKTIF } : {}),
    ...(query
      ? {
          OR: [
            { code: { contains: query, mode: "insensitive" as const } },
            { name: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const structures = await prisma.structure.findMany({
    where,
    include: {
      elements: { where: AKTIF, select: { status: true } },
      _count: { select: { elements: true } },
    },
  });

  // Doğal (sayısal) sıralama: VIA-1, VIA-2, … VIA-10 (§59 hızlı bulunabilirlik)
  const sorted = [...structures].sort((a, b) => compareStructureCodes(a.code, b.code));

  return (
    <div className="space-y-4">
      <PageTitle>Yapılar</PageTitle>

      <Card>
        <NewStructureForm />
      </Card>

      {/* Hızlı arama + filtre (§59) */}
      <Card>
        <form action="/yapilar" method="get" className="flex gap-2 flex-wrap items-center">
          <input
            name="q"
            defaultValue={query}
            placeholder="Yapı kodu veya adı ara…"
            className={`${inputClass} flex-1 min-w-48`}
          />
          <input type="hidden" name="filtre" value={activeFilter.key} />
          <button type="submit" className={buttonPrimary}>
            Ara
          </button>
        </form>
        <Chips className="mt-2">
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              href={`/yapilar?filtre=${f.key}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              active={f.key === activeFilter.key}
            >
              {f.label}
            </Chip>
          ))}
        </Chips>
      </Card>

      <SectionCard
        sectionKey="yapilar.liste"
        title={`Yapılar — ${activeFilter.label}`}
        notes={sectionNotes.get("Section:yapilar.liste") ?? []}
        canWriteNote={canWriteNote}
      >
        {sorted.length === 0 ? (
          <EmptyState
            message={
              query
                ? `"${query}" için yapı bulunamadı.`
                : "Bu filtreye uyan yapı yok. Yukarıdan yeni yapı ekleyebilirsiniz."
            }
          />
        ) : (
          <>
            <Table headers={["Kod", "Ad", "Tip", "Eleman", "Tamamlanan", "Özellik", "Durum"]}>
              {sorted.map((s) => {
                const total = s.elements.length;
                const done = s.elements.filter((e) => e.status === "TAMAMLANDI").length;
                const inProgress = s.elements.some((e) => e.status === "DEVAM_EDIYOR");
                return (
                  <tr key={s.id} className={`hover:bg-gray-50 ${s.archivedAt ? "opacity-60" : ""}`}>
                    <td className="py-2 px-2">
                      {/* min-h-11: satır yüksekliğini fazla büyütmeden 44px
                          dokunma hedefi (negatif margin ile telafi). */}
                      <Link
                        href={`/yapilar/${encodeURIComponent(s.code)}`}
                        className="inline-flex items-center min-h-11 -my-2 font-medium text-accent hover:underline"
                      >
                        {s.code}
                      </Link>
                      {s.isSample && (
                        <span className="ml-1">
                          <Badge tone="gray">ÖRNEK VERİ</Badge>
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2">{s.name}</td>
                    <td className="py-2 px-2">{label(STRUCTURE_TYPE_LABELS, s.type)}</td>
                    <td className="py-2 px-2">{total}</td>
                    <td className="py-2 px-2">
                      {done}/{total}
                    </td>
                    <td className="py-2 px-2">
                      {s.hasBalancedCantilever && <Badge tone="blue">Dengeli Konsol</Badge>}
                    </td>
                    <td className="py-2 px-2">
                      {s.archivedAt ? (
                        <Badge tone="gray">Arşivli</Badge>
                      ) : done === total && total > 0 ? (
                        <StatusBadge status="TAMAMLANDI" labelText="Tamamlandı" />
                      ) : inProgress ? (
                        <StatusBadge status="DEVAM_EDIYOR" labelText="Devam Ediyor" />
                      ) : (
                        <StatusBadge status="PLANLANDI" labelText="Planlandı" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </Table>
            <p className="text-xs text-slate-500 mt-3">{sorted.length} yapı</p>
          </>
        )}
      </SectionCard>
    </div>
  );
}
