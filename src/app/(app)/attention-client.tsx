"use client";
// Elle dikkat kalemi ekleme ve kapatma.
//
// ÖNEMLİ: Bu kontroller YALNIZCA kullanıcının kendi eklediği kalemlerde
// görünür. Sistemin ürettiği kalemler kapatılamaz/gizlenemez — onlarda
// sadece not bırakılabilir.
import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Sheet } from "@/components/sheet";
import { Field, inputClass, buttonPrimary, buttonSecondary } from "@/components/ui";
import { createAttentionItem, resolveAttentionItem } from "@/app/actions/attention";
import type { ActionResult } from "@/app/actions/piles";

export function AddAttentionItemButton() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const pathname = usePathname();

  function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    fd.set("from", pathname);
    start(async () => {
      const r = await createAttentionItem(fd);
      setResult(r);
      if (r.ok) {
        form.reset();
        setOpen(false);
      }
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
        className={`${buttonSecondary} text-xs px-3`}
      >
        + Dikkat Kalemi Ekle
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Dikkat Kalemi Ekle">
        <form
          id="attention-form"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit(e.currentTarget);
          }}
        >
          <Field label="Başlık" required>
            <input
              name="label"
              required
              className={inputClass}
              placeholder="VIA11 P05 kazı tabanında su"
            />
          </Field>

          <Field label="Durum / açıklama">
            <input
              name="detail"
              className={inputClass}
              placeholder="Gece yağmuru, taban ıslak"
            />
          </Field>

          <Field label="Neden">
            <textarea
              name="reasons"
              rows={2}
              className={inputClass}
              placeholder="Her satıra bir madde&#10;Drenaj hattı tıkalı"
            />
          </Field>

          <Field label="Ne yapılmalı">
            <textarea
              name="nextActions"
              rows={2}
              className={inputClass}
              placeholder="Her satıra bir madde&#10;Sabah 07:00 dalgıç pompa ile boşalt"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Önem">
              <select name="level" defaultValue="ORTA" className={inputClass}>
                <option value="DUSUK">Düşük</option>
                <option value="ORTA">Orta</option>
                <option value="YUKSEK">Yüksek</option>
              </select>
            </Field>
            <Field label="Geçerlilik">
              <select name="validity" defaultValue="BUGUN" className={inputClass}>
                <option value="BUGUN">Bugün</option>
                <option value="YARIN">Yarın</option>
                <option value="SURESIZ">Süresiz</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Yapı kodu">
              <input name="structureCode" className={inputClass} placeholder="VIA-11" />
            </Field>
            <Field label="Sorumlu">
              <input name="responsible" className={inputClass} placeholder="Ad Soyad / ekip" />
            </Field>
          </div>

          {result && !result.ok && <p className="text-sm text-red-700">{result.message}</p>}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={pending} className={buttonPrimary}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setOpen(false)}
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

/** Yalnızca kullanıcının kendi kalemi için render edilir. */
export function ResolveAttentionItemButton({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const pathname = usePathname();

  function submit() {
    const fd = new FormData();
    fd.set("itemId", itemId);
    fd.set("resolutionNote", note);
    fd.set("from", pathname);
    start(async () => {
      const r = await resolveAttentionItem(fd);
      setResult(r);
      if (r.ok) setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center min-h-11 px-2 -ml-2 text-xs font-medium text-gray-700 hover:underline"
      >
        Kapat
      </button>
    );
  }

  return (
    <div className="mt-1">
      <textarea
        className={inputClass}
        rows={2}
        autoFocus
        value={note}
        placeholder="Nasıl çözüldü? (opsiyonel)"
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2 mt-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className={`${buttonPrimary} text-xs px-3`}
        >
          {pending ? "…" : "Kalemi kapat"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen(false)}
          className={`${buttonSecondary} text-xs px-3`}
        >
          Vazgeç
        </button>
      </div>
      {result && !result.ok && <p className="text-xs text-red-700 mt-1">{result.message}</p>}
    </div>
  );
}
