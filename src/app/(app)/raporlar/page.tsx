// Raporlar (madde 46): ekranda tablo + Excel indirme. Tek veri kaynağı: reports servisi.
import Link from "next/link";
import { Card, EmptyState, PageTitle, Table, buttonSuccess } from "@/components/ui";
import { REPORTS } from "@/lib/services/reports";

export const dynamic = "force-dynamic";

export default async function RaporlarPage({
  searchParams,
}: {
  searchParams: Promise<{ tip?: string }>;
}) {
  const { tip } = await searchParams;
  const selected = tip && REPORTS[tip] ? tip : "gunluk";
  const def = await REPORTS[selected].run();

  return (
    <div className="space-y-4">
      <PageTitle
        actions={
          <a
            href={`/api/rapor/${selected}`}
            className={`${buttonSuccess}`}
          >
            Excel İndir
          </a>
        }
      >
        Raporlar
      </PageTitle>

      <div className="flex gap-2 flex-wrap">
        {Object.entries(REPORTS).map(([key, r]) => (
          <Link
            key={key}
            href={`/raporlar?tip=${key}`}
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              key === selected
                ? "bg-blue-700 text-white"
                : "bg-white border border-gray-300 text-gray-700"
            }`}
          >
            {r.title}
          </Link>
        ))}
      </div>

      <Card title={def.title}>
        {def.rows.length === 0 ? (
          <EmptyState message="Bu raporda gösterilecek kayıt yok." />
        ) : (
          <Table headers={def.headers}>
            {def.rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {row.map((cell, j) => (
                  <td key={j} className="py-1.5 px-2 whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </Table>
        )}
        <p className="text-xs text-slate-500 mt-3">{def.rows.length} kayıt</p>
      </Card>
    </div>
  );
}
