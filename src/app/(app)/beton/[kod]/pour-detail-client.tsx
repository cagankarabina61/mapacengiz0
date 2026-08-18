"use client";
// Beton detayının etkileşimli kısımları: checklist toggle, override, durum geçişi.
import { useState, useTransition } from "react";
import {
  toggleChecklistItem,
  overridePour,
  transitionPour,
  overrideResourceConflict,
} from "@/app/actions/pours";
import type { ActionResult } from "@/app/actions/piles";
import { buttonPrimary, buttonSuccess, inputClass } from "@/components/ui";

export interface ChecklistItemView {
  id: string;
  label: string;
  isChecked: boolean;
  checkedByName: string | null;
  checkedAt: string | null;
}

export function ChecklistPanel({ items }: { items: ChecklistItemView[] }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (itemId: string) => {
    const fd = new FormData();
    fd.set("itemId", itemId);
    startTransition(async () => {
      setResult(await toggleChecklistItem(fd));
    });
  };

  return (
    <div>
      {result && !result.ok && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">
          {result.message}
        </p>
      )}
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => toggle(item.id)}
              disabled={pending}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left text-sm border ${
                item.isChecked
                  ? "bg-green-50 border-green-200 text-green-900"
                  : "bg-white border-gray-200 hover:bg-gray-50"
              }`}
            >
              <span
                className={`w-5 h-5 shrink-0 rounded border flex items-center justify-center text-xs font-bold ${
                  item.isChecked ? "bg-green-600 border-green-600 text-white" : "border-gray-300"
                }`}
              >
                {item.isChecked ? "✓" : ""}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.isChecked && item.checkedByName && (
                <span className="text-xs text-gray-500 shrink-0">
                  {item.checkedByName} · {item.checkedAt}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OverridePanel({ pourId }: { pourId: string }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    startTransition(async () => {
      setResult(await overridePour(formData));
    });
  };

  return (
    <form action={submit} className="space-y-2">
      <input type="hidden" name="pourId" value={pourId} />
      <p className="text-xs text-gray-600">
        Ön koşullar tamamlanmadan dökümü &quot;Hazır&quot; saymak için yetkili override gereklidir.
        Bu işlem kim/ne zaman/neden bilgisiyle kayıt altına alınır.
      </p>
      <textarea
        name="reason"
        required
        placeholder="Override gerekçesi (zorunlu)"
        className={inputClass}
        rows={2}
      />
      <button
        type="submit"
        disabled={pending}
        className="px-3 py-1.5 rounded-md text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
      >
        {pending ? "Uygulanıyor…" : "Override Uygula"}
      </button>
      {result && (
        <p
          className={`text-sm px-2 py-1 rounded ${
            result.ok ? "text-green-800 bg-green-50" : "text-red-800 bg-red-50"
          }`}
        >
          {result.message}
        </p>
      )}
    </form>
  );
}

/** Kritik kaynak çakışmasını gerekçeyle kabul etme (madde 4). */
export function ConflictOverridePanel({ pourId }: { pourId: string }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => startTransition(async () => setResult(await overrideResourceConflict(fd)))}
      className="space-y-2 mt-2"
    >
      <input type="hidden" name="pourId" value={pourId} />
      <p className="text-xs text-gray-600">
        Kritik çakışmayı kabul etmek için gerekçe zorunludur. Kim, ne zaman ve neden kabul ettiği
        kayıt altına alınır.
      </p>
      <input
        name="reason"
        required
        placeholder="Çakışmayı kabul etme gerekçesi (zorunlu)"
        className={inputClass}
      />
      <button
        type="submit"
        disabled={pending}
        className="px-3 py-1.5 rounded-md text-sm font-medium bg-red-700 hover:bg-red-800 text-white disabled:opacity-50"
      >
        {pending ? "Kaydediliyor…" : "Çakışmayı Kabul Et"}
      </button>
      {result && (
        <p
          className={`text-sm px-2 py-1 rounded ${
            result.ok ? "text-green-800 bg-green-50" : "text-red-800 bg-red-50"
          }`}
        >
          {result.message}
        </p>
      )}
    </form>
  );
}

export function TransitionPanel({
  pourId,
  status,
  isReady,
}: {
  pourId: string;
  status: string;
  isReady: boolean;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const go = (to: string, extra?: Record<string, string>) => {
    const fd = new FormData();
    fd.set("pourId", pourId);
    fd.set("to", to);
    for (const [k, v] of Object.entries(extra ?? {})) fd.set(k, v);
    startTransition(async () => {
      setResult(await transitionPour(fd));
    });
  };

  return (
    <div className="space-y-2">
      {result && (
        <p
          className={`text-sm px-2 py-1 rounded ${
            result.ok ? "text-green-800 bg-green-50" : "text-red-800 bg-red-50"
          }`}
        >
          {result.message}
        </p>
      )}
      {status !== "BETON_DOKULUYOR" && status !== "TAMAMLANDI" && (
        <button
          onClick={() => go("BETON_DOKULUYOR")}
          disabled={pending || !isReady}
          title={!isReady ? "Ön koşullar tamamlanmadan döküm başlatılamaz." : undefined}
          className={`${buttonPrimary}`}
        >
          Dökümü Başlat
        </button>
      )}
      {status === "BETON_DOKULUYOR" && (
        <form
          action={(fd) => {
            go("TAMAMLANDI", {
              actualVolumeM3: String(fd.get("actualVolumeM3") ?? ""),
            });
          }}
          className="flex gap-2 items-end flex-wrap"
        >
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">
              Gerçekleşen Hacim (m³)
            </span>
            <input
              name="actualVolumeM3"
              type="number"
              step="0.1"
              min="0.1"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-40"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className={`${buttonSuccess}`}
          >
            Dökümü Tamamla
          </button>
        </form>
      )}
    </div>
  );
}
