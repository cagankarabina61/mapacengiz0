// Tek veri kaynağından iki görünüm: md+ tablo, md altı etiketli kart listesi.
// Sunucu-güvenli, sıfır JS — iki DOM ağacı hidden/block ile değiştirilir.
//
// md+ görünümü bugünkü tablonun aynısıdır; masaüstünde hiçbir gerileme yoktur.
import type { ReactNode } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Kart görünümünde başlık satırı olur (etiketsiz, kalın). */
  primary?: boolean;
  /** Kart görünümünde sağ üstte rozet olur (etiketsiz). */
  badge?: boolean;
  /** Yalnızca tabloda görünür — kartta gizlenir. */
  desktopOnly?: boolean;
  /** Hücreye eklenecek sınıflar (ör. whitespace-nowrap, text-right). */
  className?: string;
}

export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Verilirse kart başlığı bağlantı olur. */
  rowHref?: (row: T) => string;
  empty: string;
}) {
  if (rows.length === 0) return <EmptyState message={empty} />;

  const primary = columns.find((c) => c.primary) ?? columns[0];
  const badge = columns.find((c) => c.badge);
  const details = columns.filter((c) => c !== primary && c !== badge && !c.desktopOnly);

  return (
    <>
      {/* md+ — tablo */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-300 text-left">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap"
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c) => (
                  <td key={c.key} className={`py-1.5 px-2 ${c.className ?? ""}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* md altı — etiketli kart listesi */}
      <ul className="md:hidden divide-y divide-gray-100">
        {rows.map((row) => (
          <li key={rowKey(row)} className="py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium min-w-0 break-words">
                {rowHref ? (
                  <Link href={rowHref(row)} className="hover:underline">
                    {primary.cell(row)}
                  </Link>
                ) : (
                  primary.cell(row)
                )}
              </div>
              {badge && <div className="shrink-0">{badge.cell(row)}</div>}
            </div>
            {details.length > 0 && (
              <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                {details.map((c) => (
                  <div key={c.key} className="text-xs min-w-0">
                    <dt className="inline text-gray-500">{c.header}: </dt>
                    <dd className="inline text-gray-800 break-words">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
