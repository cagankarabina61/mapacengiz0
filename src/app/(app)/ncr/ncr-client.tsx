"use client";
// NCR oluşturma formu + durum güncelleme panelleri.
import { useState, useTransition } from "react";
import { createNCR, updateNCRStatus } from "@/app/actions/qaqc";
import type { ActionResult } from "@/app/actions/piles";
import { Field, inputClass } from "@/components/ui";

export interface StructureOption {
  id: string;
  code: string;
  elements: { id: string; code: string; name: string }[];
}

export interface UserOption {
  id: string;
  name: string;
}

export function NCRForm({
  structures,
  users,
}: {
  structures: StructureOption[];
  users: UserOption[];
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [structureId, setStructureId] = useState("");
  const [pending, startTransition] = useTransition();

  const elements = structures.find((s) => s.id === structureId)?.elements ?? [];

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const res = await createNCR(formData);
      setResult(res);
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
            {elements.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.code})
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Problem Açıklaması" required>
        <textarea name="problemDescription" required rows={3} className={inputClass} />
      </Field>
      <Field label="İşe Etkisi" required>
        <select name="impact" className={inputClass} defaultValue="UYARI">
          <option value="BILGILENDIRME">Bilgilendirme — iş akışını etkilemez</option>
          <option value="UYARI">Uyarı — iş devam eder, ekranlarda uyarı gösterilir</option>
          <option value="BLOKAJ">Blokaj — ilgili iş bloke edilir</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sorumlu">
          <select name="responsibleUserId" className={inputClass} defaultValue="">
            <option value="">Seçilmedi</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Son Tarih">
          <input name="dueDate" type="date" className={inputClass} />
        </Field>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded-md text-sm font-semibold bg-blue-700 hover:bg-blue-800 text-white disabled:opacity-50"
      >
        {pending ? "Kaydediliyor…" : "NCR Oluştur"}
      </button>
    </form>
  );
}

export function NCRStatusPanel({
  ncrId,
  status,
  hasCorrectiveAction,
}: {
  ncrId: string;
  status: string;
  hasCorrectiveAction: boolean;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [showClose, setShowClose] = useState(false);
  const [pending, startTransition] = useTransition();

  const update = (newStatus: string, correctiveAction?: string) => {
    const fd = new FormData();
    fd.set("ncrId", ncrId);
    fd.set("status", newStatus);
    if (correctiveAction) fd.set("correctiveAction", correctiveAction);
    startTransition(async () => {
      setResult(await updateNCRStatus(fd));
    });
  };

  return (
    <div className="space-y-2">
      {result && (
        <p
          className={`text-xs px-2 py-1 rounded ${
            result.ok ? "text-green-800 bg-green-50" : "text-red-800 bg-red-50"
          }`}
        >
          {result.message}
        </p>
      )}
      <div className="flex gap-2 flex-wrap">
        {status === "ACIK" && (
          <button
            onClick={() => update("DUZELTME_YAPILIYOR")}
            disabled={pending}
            className="px-3 py-1.5 rounded text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
          >
            Düzeltmeye Başla
          </button>
        )}
        {status !== "KAPATILDI" && (
          <button
            onClick={() => (hasCorrectiveAction ? update("KAPATILDI") : setShowClose(true))}
            disabled={pending}
            className="px-3 py-1.5 rounded text-xs font-medium bg-green-700 hover:bg-green-800 text-white disabled:opacity-50"
          >
            Kapat
          </button>
        )}
      </div>
      {showClose && (
        <form
          action={(fd) => {
            update("KAPATILDI", String(fd.get("correctiveAction") ?? ""));
            setShowClose(false);
          }}
          className="flex gap-2 items-end"
        >
          <label className="flex-1">
            <span className="block text-xs font-medium text-gray-600 mb-1">
              Düzeltici Faaliyet (kapatmak için zorunlu)
            </span>
            <input name="correctiveAction" required className={inputClass} />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="px-3 py-2 rounded text-xs font-medium bg-green-700 text-white disabled:opacity-50"
          >
            Onayla
          </button>
        </form>
      )}
    </div>
  );
}
