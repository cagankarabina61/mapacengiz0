"use client";
// Excel kazık import akışı: Yükle → Önizleme (hatalı satırlar işaretli) → Onay → Aktar.
import { useState, useTransition } from "react";
import { previewPileImport, confirmPileImport } from "@/app/actions/import";
import type { ImportPreviewResult } from "@/lib/import-format";
import { Badge } from "@/components/ui";

export function ImportPanel() {
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const doPreview = (formData: FormData) => {
    setConfirmResult(null);
    startTransition(async () => {
      setPreview(await previewPileImport(formData));
    });
  };

  const doConfirm = () => {
    if (!preview) return;
    const fd = new FormData();
    fd.set("payload", JSON.stringify(preview.rows));
    startTransition(async () => {
      const res = await confirmPileImport(fd);
      setConfirmResult(res);
      if (res.ok) setPreview(null);
    });
  };

  return (
    <div className="space-y-4">
      <form action={doPreview} className="flex items-end gap-3 flex-wrap">
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">
            Excel Dosyası (.xlsx)
          </span>
          <input
            name="file"
            type="file"
            required
            accept=".xlsx"
            className="block text-sm text-gray-700 file:mr-3 file:px-3 file:py-2 file:rounded-md file:border-0 file:bg-blue-700 file:text-white file:text-sm file:font-medium"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-md text-sm font-semibold bg-blue-700 hover:bg-blue-800 text-white disabled:opacity-50"
        >
          {pending ? "Okunuyor…" : "Önizle"}
        </button>
        <a href="/api/sablon/kazik" className="text-sm text-blue-700 hover:underline py-2">
          Şablonu indir
        </a>
      </form>

      {confirmResult && (
        <p
          className={`text-sm px-3 py-2 rounded border ${
            confirmResult.ok
              ? "text-green-800 bg-green-50 border-green-200"
              : "text-red-800 bg-red-50 border-red-200"
          }`}
        >
          {confirmResult.message}
        </p>
      )}

      {preview && (
        <div className="space-y-3">
          <p
            className={`text-sm px-3 py-2 rounded border ${
              preview.ok
                ? "text-blue-900 bg-blue-50 border-blue-200"
                : "text-red-800 bg-red-50 border-red-200"
            }`}
          >
            {preview.message}
          </p>

          {preview.rows.length > 0 && (
            <>
              <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-300 text-left">
                      <th className="py-2 px-2 font-semibold text-gray-600">Satır</th>
                      <th className="py-2 px-2 font-semibold text-gray-600">Kazık Kodu</th>
                      <th className="py-2 px-2 font-semibold text-gray-600">Eleman</th>
                      <th className="py-2 px-2 font-semibold text-gray-600">Çap</th>
                      <th className="py-2 px-2 font-semibold text-gray-600">Boy</th>
                      <th className="py-2 px-2 font-semibold text-gray-600">Beton</th>
                      <th className="py-2 px-2 font-semibold text-gray-600">Durum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.rows.map((r) => (
                      <tr key={r.rowNumber} className={r.errors.length > 0 ? "bg-red-50" : ""}>
                        <td className="py-1.5 px-2 text-gray-400">{r.rowNumber}</td>
                        <td className="py-1.5 px-2 font-medium">{r.code || "—"}</td>
                        <td className="py-1.5 px-2">{r.elementCode || "—"}</td>
                        <td className="py-1.5 px-2">{r.diameterMm ?? "—"}</td>
                        <td className="py-1.5 px-2">{r.designLengthM ?? "—"}</td>
                        <td className="py-1.5 px-2">{r.concreteClass ?? "Belirtilmemiş"}</td>
                        <td className="py-1.5 px-2">
                          {r.errors.length === 0 ? (
                            <Badge tone="green">Geçerli</Badge>
                          ) : (
                            <span className="text-xs text-red-700">{r.errors.join(" ")}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={doConfirm}
                disabled={pending || preview.validCount === 0}
                className="px-4 py-2 rounded-md text-sm font-semibold bg-green-700 hover:bg-green-800 text-white disabled:opacity-50"
              >
                {pending
                  ? "Aktarılıyor…"
                  : `${preview.validCount} Geçerli Satırı İçe Aktar`}
              </button>
              {preview.errorCount > 0 && (
                <p className="text-xs text-gray-500">
                  Hatalı {preview.errorCount} satır aktarılmayacak. Düzeltip yeniden yükleyebilirsiniz.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
