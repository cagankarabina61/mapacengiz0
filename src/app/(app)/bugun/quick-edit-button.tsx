"use client";
// Liste satırından hızlı düzenleme — sahanın telefondan tek dokunuşla
// zaman damgası girmesi, durum değiştirmesi ve not bırakması için.
//
// Tek sheet iki entity'yi sürer (aktivite / beton dökümü): action'lar ayrıdır
// ama AYNI FormData alan adlarını kabul eder, tekrar burada kalkar.
import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Sheet } from "@/components/sheet";
import { Field, inputClass, buttonPrimary, buttonSecondary } from "@/components/ui";
import { quickEditActivity, quickEditPour } from "@/app/actions/quick-edit";
import { ACTIVITY_STATUS_LABELS, POUR_STATUS_LABELS } from "@/lib/labels";
import type { ActionResult } from "@/app/actions/piles";

export interface CrewOption {
  id: string;
  name: string;
}

export interface QuickEditTarget {
  id: string;
  kind: "ACTIVITY" | "POUR";
  title: string;
  status: string;
  crewResourceId: string | null;
  hasStart: boolean;
  hasEnd: boolean;
}

export function QuickEditButton({
  target,
  crews,
}: {
  target: QuickEditTarget;
  crews: CrewOption[];
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [stampStart, setStampStart] = useState(false);
  const [stampEnd, setStampEnd] = useState(false);
  const [pending, start] = useTransition();
  const pathname = usePathname();

  const statusLabels = target.kind === "POUR" ? POUR_STATUS_LABELS : ACTIVITY_STATUS_LABELS;

  function close() {
    setOpen(false);
    setStampStart(false);
    setStampEnd(false);
  }

  function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    fd.set("id", target.id);
    fd.set("from", pathname);
    if (stampStart) fd.set("stampStart", "1");
    if (stampEnd) fd.set("stampEnd", "1");
    const action = target.kind === "POUR" ? quickEditPour : quickEditActivity;
    start(async () => {
      const r = await action(fd);
      setResult(r);
      if (r.ok) close();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setResult(null);
        }}
        className={`${buttonSecondary} text-xs px-3 shrink-0`}
      >
        Düzenle
      </button>

      <Sheet open={open} onClose={close} title={target.title}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(e.currentTarget);
          }}
        >
          {/* 1. Tek dokunuş yolu en üstte — sahada en çok kullanılan işlem. */}
          <div className="space-y-2">
            <button
              type="button"
              disabled={target.hasStart}
              onClick={() => setStampStart((v) => !v)}
              className={`w-full min-h-14 rounded-md text-sm font-semibold border-2 ${
                target.hasStart
                  ? "bg-gray-100 text-slate-500 border-gray-200 cursor-not-allowed"
                  : stampStart
                    ? "bg-blue-700 text-white border-blue-700"
                    : "bg-white text-blue-800 border-blue-300"
              }`}
            >
              {target.hasStart
                ? "Başlangıç saati zaten girilmiş"
                : stampStart
                  ? "✓ Şimdi başladı olarak işaretlenecek"
                  : "Bugün Başladı"}
            </button>
            <button
              type="button"
              disabled={target.hasEnd}
              onClick={() => setStampEnd((v) => !v)}
              className={`w-full min-h-14 rounded-md text-sm font-semibold border-2 ${
                target.hasEnd
                  ? "bg-gray-100 text-slate-500 border-gray-200 cursor-not-allowed"
                  : stampEnd
                    ? "bg-blue-700 text-white border-blue-700"
                    : "bg-white text-blue-800 border-blue-300"
              }`}
            >
              {target.hasEnd
                ? "Bitiş saati zaten girilmiş"
                : stampEnd
                  ? "✓ Şimdi bitti olarak işaretlenecek"
                  : "Bugün Bitti"}
            </button>
            {stampEnd && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                Bitiş saati işlenecek. İş gerçekten tamamlandıysa durumu da
                &quot;Tamamlandı&quot; yapın — sistem bunu kendiliğinden değiştirmez.
              </p>
            )}
          </div>

          <Field label="Durum">
            <select name="status" defaultValue={target.status} className={inputClass}>
              {Object.entries(statusLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Ekip">
            <select
              name="crewResourceId"
              defaultValue={target.crewResourceId ?? ""}
              className={inputClass}
            >
              <option value="">Atanmamış</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Not">
            <textarea
              name="note"
              rows={3}
              className={inputClass}
              placeholder="Sahadan not… (değişikliğin gerekçesi olarak da kaydedilir)"
            />
          </Field>

          {result && !result.ok && <p className="text-sm text-red-700">{result.message}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={buttonPrimary}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={close}
              className={buttonSecondary}
            >
              Vazgeç
            </button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
