"use client";
// Doküman yükleme formu: dosya adından ÖNERİ üretir, kullanıcı onaylamadan kaydetmez (madde 51).
import { useState, useTransition } from "react";
import { uploadDocument } from "@/app/actions/documents";
import type { ActionResult } from "@/app/actions/piles";
import { parseDrawingFilename, matchElementCode } from "@/lib/logic/filename-match";
import { Field, inputClass } from "@/components/ui";

export interface EntityOption {
  entityType: string;
  entityId: string;
  label: string;
  structureCode: string | null;
  elementCode: string | null;
}

export function UploadForm({
  entities,
  structureCodes,
}: {
  entities: EntityOption[];
  structureCodes: string[];
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [pending, startTransition] = useTransition();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const parsed = parseDrawingFilename(file.name, structureCodes);
    if (!parsed.structureCode && !parsed.elementToken) {
      setSuggestion(null);
      return;
    }
    // Öneriyi eleman kaydına eşle
    let matchedEntity: EntityOption | undefined;
    if (parsed.structureCode && parsed.elementToken) {
      const candidates = entities.filter(
        (en) => en.structureCode === parsed.structureCode && en.elementCode
      );
      const matchedCode = matchElementCode(
        parsed.elementToken,
        candidates.map((c) => c.elementCode!)
      );
      matchedEntity = candidates.find((c) => c.elementCode === matchedCode);
    }
    if (!matchedEntity && parsed.structureCode) {
      matchedEntity = entities.find(
        (en) => en.entityType === "Structure" && en.structureCode === parsed.structureCode
      );
    }
    if (matchedEntity) {
      setSelectedKey(`${matchedEntity.entityType}:${matchedEntity.entityId}`);
      setSuggestion(
        `Dosya adından öneri: ${matchedEntity.label}${
          parsed.revisionCode ? ` · ${parsed.revisionCode}` : ""
        } — lütfen kontrol edip onaylayın.`
      );
    } else {
      setSuggestion(null);
    }
  };

  const submit = (formData: FormData) => {
    const [entityType, entityId] = String(formData.get("entityKey") ?? "").split(":");
    formData.set("entityType", entityType ?? "");
    formData.set("entityId", entityId ?? "");
    startTransition(async () => {
      setResult(await uploadDocument(formData));
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
      <Field label="Dosya (PDF, fotoğraf, Excel — en fazla 50 MB)" required>
        <input
          name="file"
          type="file"
          required
          onChange={onFileChange}
          accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.dwg,.docx"
          className="block w-full text-sm text-gray-700 file:mr-3 file:px-3 file:py-2 file:rounded-md file:border-0 file:bg-blue-700 file:text-white file:text-sm file:font-medium"
        />
      </Field>
      {suggestion && (
        <p className="text-sm text-blue-900 bg-blue-50 border border-blue-200 rounded px-3 py-2">
          {suggestion}
        </p>
      )}
      <Field label="Bağlanacak Kayıt" required>
        <select
          name="entityKey"
          required
          className={inputClass}
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
        >
          <option value="" disabled>
            Kayıt seçin…
          </option>
          {entities.map((en) => (
            <option key={`${en.entityType}:${en.entityId}`} value={`${en.entityType}:${en.entityId}`}>
              {en.label}
            </option>
          ))}
        </select>
      </Field>
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded-md text-sm font-semibold bg-blue-700 hover:bg-blue-800 text-white disabled:opacity-50"
      >
        {pending ? "Yükleniyor…" : "Yükle"}
      </button>
    </form>
  );
}
