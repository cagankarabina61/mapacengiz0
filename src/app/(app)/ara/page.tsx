// Global arama (madde 44): tek kutudan yapı/eleman/kazık/beton/RFI/NCR/çizim.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, PageTitle, EmptyState, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

interface Hit {
  kind: string;
  label: string;
  href: string;
  detail?: string;
}

export default async function AraPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  let hits: Hit[] = [];
  if (query.length >= 2) {
    // "VIA11 P5" gibi boşluklu aramalar: HER terim, alanlardan HERHANGİ birinde geçmeli.
    // "P4" ↔ "P04" gibi sıfır dolgu farkları da varyant olarak denenir.
    const terms = query.split(/\s+/).filter(Boolean);
    const variants = (t: string): string[] => {
      const out = new Set([t]);
      const m = t.match(/^([A-Za-z]+[-_]?)(\d+)$/);
      if (m) {
        const num = parseInt(m[2], 10);
        out.add(`${m[1]}${String(num).padStart(2, "0")}`); // P4 → P04
        out.add(`${m[1]}${num}`); // P04 → P4
      }
      return [...out];
    };
    // Her terim için: alanların × varyantların OR'u; terimler arası AND.
    const termAnd = (fields: string[]) => ({
      AND: terms.map((t) => ({
        OR: fields.flatMap((f) =>
          variants(t).map((v) => {
            // "a.b.c" → iç içe relation filtresi
            const parts = f.split(".");
            let cond: Record<string, unknown> = {
              [parts[parts.length - 1]]: { contains: v, mode: "insensitive" },
            };
            for (let i = parts.length - 2; i >= 0; i--) cond = { [parts[i]]: cond };
            return cond;
          })
        ),
      })),
    });

    const [structures, elements, piles, pours, rfis, ncrs, drawings] = await Promise.all([
      prisma.structure.findMany({
        where: termAnd(["code", "name"]) as never,
        take: 10,
      }),
      prisma.structureElement.findMany({
        where: termAnd(["code", "name", "structure.code"]) as never,
        include: { structure: true },
        take: 15,
      }),
      prisma.pile.findMany({
        where: termAnd(["code"]) as never,
        include: { pileGroup: { include: { element: { include: { structure: true } } } } },
        take: 15,
      }),
      prisma.concretePour.findMany({
        where: termAnd(["code"]) as never,
        take: 10,
      }),
      prisma.rFI.findMany({
        where: termAnd(["rfiNumber", "subject", "structure.code"]) as never,
        take: 10,
      }),
      prisma.nCR.findMany({
        where: termAnd(["ncrNumber", "problemDescription", "structure.code"]) as never,
        take: 10,
      }),
      prisma.drawing.findMany({
        where: termAnd(["code", "title", "structure.code"]) as never,
        take: 10,
      }),
    ]);

    hits = [
      // Arama arşivlileri de gösterir (§49: veri sessizce yok edilmez) ama işaretler.
      ...structures.map((s) => ({
        kind: "Yapı",
        label: `${s.code} — ${s.name}`,
        detail: s.archivedAt ? "Arşivli" : undefined,
        href: `/yapilar/${encodeURIComponent(s.code)}`,
      })),
      ...elements.map((e) => ({
        kind: "Eleman",
        label: `${e.structure.code} ${e.name}`,
        detail: e.archivedAt ? `${e.code} · Arşivli` : e.code,
        href: `/yapilar/${encodeURIComponent(e.structure.code)}`,
      })),
      ...piles.map((p) => ({
        kind: "Kazık",
        label: p.code,
        detail: p.pileGroup.element.structure.code,
        href: `/kazik?yapi=${encodeURIComponent(p.pileGroup.element.structure.code)}`,
      })),
      ...pours.map((p) => ({
        kind: "Beton",
        label: p.code,
        href: `/beton/${encodeURIComponent(p.code)}`,
      })),
      ...rfis.map((r) => ({
        kind: "RFI",
        label: `${r.rfiNumber} — ${r.subject}`,
        href: "/rfi",
      })),
      ...ncrs.map((n) => ({
        kind: "NCR",
        label: n.ncrNumber,
        detail: n.problemDescription.slice(0, 60),
        href: "/ncr",
      })),
      ...drawings.map((d) => ({
        kind: "Çizim",
        label: `${d.code} — ${d.title}`,
        href: "/cizimler",
      })),
    ];
  }

  return (
    <div className="space-y-4">
      <PageTitle>Arama</PageTitle>
      <Card>
        <form action="/ara" method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={query}
            placeholder="örn. VIA11 P5, POUR-2026, RFI-024…"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-md text-sm font-medium bg-blue-700 hover:bg-blue-800 text-white"
          >
            Ara
          </button>
        </form>
      </Card>

      {query.length >= 2 && (
        <Card title={`"${query}" için sonuçlar`}>
          {hits.length === 0 ? (
            <EmptyState message="Sonuç bulunamadı." />
          ) : (
            <ul className="divide-y divide-gray-100">
              {hits.map((h, i) => (
                <li key={i}>
                  <Link href={h.href} className="flex items-center gap-3 py-2 hover:bg-gray-50 px-1 rounded">
                    <Badge tone="gray">{h.kind}</Badge>
                    <span className="text-sm font-medium">{h.label}</span>
                    {h.detail && <span className="text-xs text-gray-500">{h.detail}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {query.length === 1 && (
        <Card>
          <EmptyState message="Arama için en az 2 karakter girin." />
        </Card>
      )}
    </div>
  );
}
