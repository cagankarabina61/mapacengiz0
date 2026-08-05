"use client";
// RFI oluşturma formu (etkilenen aktiviteler seçimiyle) + durum geçiş butonları.
import { useState, useTransition } from "react";
import { createRFI, transitionRFI } from "@/app/actions/rfi";
import type { ActionResult } from "@/app/actions/piles";
import { Field, inputClass } from "@/components/ui";

export interface RFIStructureOption {
  id: string;
  code: string;
  elements: { id: string; code: string; name: string }[];
  activities: { id: string; label: string }[];
}

export function RFIForm({ structures }: { structures: RFIStructureOption[] }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [structureId, setStructureId] = useState("");
  const [pending, startTransition] = useTransition();

  const current = structures.find((s) => s.id === structureId);

  const submit = (formData: FormData) => {
    startTransition(async () => {
      setResult(await createRFI(formData));
    });
  };

  return (
    <form action={submit} className="space-y-3 max-w-lg">
      {result && (
        <p
          className={`text-sm px-3 py-2 rounded border ${
            result.ok
              ? "text-green-800 bg-green-50 border-green-200"
              : "text-red-800 bg-red-50 border-red-200"
          }`}
        >
          {result.message}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Yapı" required>
          <select
            name="structureId"
            required
            className={inputClass}
            value={structureId}
            onChange={(e) => setStructureId(e.target.value)}
          >
            <option value="" disabled>
              Yapı seçin…
            </option>
            {structures.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Eleman">
          <select name="elementId" className={inputClass} defaultValue="">
            <option value="">Seçilmedi</option>
            {(current?.elements ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.code})
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Konu" required>
        <input name="subject" required className={inputClass} />
      </Field>
      <Field label="Açıklama">
        <textarea name="description" rows={3} className={inputClass} />
      </Field>
      <Field label="Öncelik">
        <select name="priority" className={inputClass} defaultValue="ORTA">
          <option value="DUSUK">Düşük</option>
          <option value="ORTA">Orta</option>
          <option value="YUKSEK">Yüksek</option>
          <option value="KRITIK">Kritik</option>
        </select>
      </Field>
      {current && current.activities.length > 0 && (
        <Field label="Etkilenen İşler (RFI cevaplanana kadar bloke olur)">
          <div className="border border-gray-300 rounded-md p-2 max-h-40 overflow-y-auto space-y-1 bg-white">
            {current.activities.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="affectedActivityIds" value={a.id} className="w-4 h-4" />
                {a.label}
              </label>
            ))}
          </div>
        </Field>
      )}
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded-md text-sm font-semibold bg-blue-700 hover:bg-blue-800 text-white disabled:opacity-50"
      >
        {pending ? "Kaydediliyor…" : "RFI Oluştur"}
      </button>
    </form>
  );
}

const NEXT_ACTIONS: Record<string, { to: string; label: string; cls: string }[]> = {
  TASLAK: [{ to: "GONDERILDI", label: "Gönder", cls: "bg-blue-700 hover:bg-blue-800" }],
  GONDERILDI: [
    { to: "CEVAP_BEKLENIYOR", label: "Cevap Bekleniyor", cls: "bg-amber-500 hover:bg-amber-600" },
    { to: "CEVAPLANDI", label: "Cevaplandı", cls: "bg-green-700 hover:bg-green-800" },
  ],
  CEVAP_BEKLENIYOR: [
    { to: "CEVAPLANDI", label: "Cevaplandı", cls: "bg-green-700 hover:bg-green-800" },
  ],
  CEVAPLANDI: [{ to: "KAPATILDI", label: "Kapat", cls: "bg-gray-700 hover:bg-gray-800" }],
  KAPATILDI: [],
};

export function RFITransitions({ rfiId, status }: { rfiId: string; status: string }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const go = (to: string) => {
    const fd = new FormData();
    fd.set("rfiId", rfiId);
    fd.set("status", to);
    startTransition(async () => {
      setResult(await transitionRFI(fd));
    });
  };

  const actions = NEXT_ACTIONS[status] ?? [];
  return (
    <div className="space-y-1">
      <div className="flex gap-1 flex-wrap justify-end">
        {actions.map((a) => (
          <button
            key={a.to}
            onClick={() => go(a.to)}
            disabled={pending}
            className={`px-3 py-1.5 rounded text-xs font-medium text-white disabled:opacity-50 ${a.cls}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {result && !result.ok && (
        <p className="text-xs text-red-700 bg-red-50 rounded px-2 py-1">{result.message}</p>
      )}
    </div>
  );
}
