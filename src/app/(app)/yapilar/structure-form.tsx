"use client";
// Yeni yapı/VIA ekleme formu (§43). Gereksiz modal/sayfa geçişi yok — inline açılır (§59).
import { useState, useTransition } from "react";
import { createStructure } from "@/app/actions/structures";
import type { ActionResult } from "@/app/actions/piles";
import { Field, inputClass } from "@/components/ui";
import { STRUCTURE_TYPE_LABELS } from "@/lib/labels";

export function NewStructureForm() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const res = await createStructure(formData);
      setResult(res);
      if (res.ok) setOpen(false);
    });
  };

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => {
            setOpen((v) => !v);
            setResult(null);
          }}
          className="px-4 py-2 rounded-md text-sm font-medium bg-blue-700 hover:bg-blue-800 text-white"
        >
          {open ? "Vazgeç" : "+ Yeni Yapı"}
        </button>
        {result && (
          <span
            className={`text-sm px-2 py-1 rounded ${
              result.ok ? "text-green-800 bg-green-50" : "text-red-800 bg-red-50"
            }`}
          >
            {result.message}
          </span>
        )}
      </div>

      {open && (
        <form action={submit} className="mt-3 grid gap-3 md:grid-cols-2 max-w-3xl">
          <Field label="Yapı Kodu" required>
            <input
              name="code"
              required
              placeholder="örn. VIA-49"
              className={inputClass}
              autoFocus
            />
          </Field>
          <Field label="Yapı Adı" required>
            <input name="name" required placeholder="örn. Viyadük 49" className={inputClass} />
          </Field>
          <Field label="Yapı Tipi" required>
            <select name="type" defaultValue="VIYADUK" className={inputClass}>
              {Object.entries(STRUCTURE_TYPE_LABELS).map(([value, lbl]) => (
                <option key={value} value={value}>
                  {lbl}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="hasBalancedCantilever" className="w-4 h-4" />
              Dengeli konsol var
            </label>
          </div>
          <Field label="Başlangıç Kilometrajı">
            <input name="startChainage" placeholder="örn. km 42+650" className={inputClass} />
          </Field>
          <Field label="Bitiş Kilometrajı">
            <input name="endChainage" placeholder="örn. km 43+120" className={inputClass} />
          </Field>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 rounded-md text-sm font-semibold bg-blue-700 hover:bg-blue-800 text-white disabled:opacity-50"
            >
              {pending ? "Kaydediliyor…" : "Yapıyı Oluştur"}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Yapı boş oluşturulur; pier ve diğer elemanlar yapı sayfasından ihtiyaç oldukça eklenir.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
