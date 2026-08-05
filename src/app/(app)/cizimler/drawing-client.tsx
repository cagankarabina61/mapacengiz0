"use client";
// Çizim modülü etkileşimli kısımları: çizim/revizyon ekleme, saha revizyonu işaretleme.
import { useState, useTransition } from "react";
import {
  createDrawing,
  addRevision,
  updateRevisionStatus,
  setSiteUsedRevision,
} from "@/app/actions/drawings";
import type { ActionResult } from "@/app/actions/piles";
import { Field, inputClass } from "@/components/ui";

export interface DrawingStructureOption {
  id: string;
  code: string;
  elements: { id: string; code: string; name: string }[];
}

function ResultBanner({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p
      className={`text-sm px-3 py-2 rounded border ${
        result.ok
          ? "text-green-800 bg-green-50 border-green-200"
          : "text-red-800 bg-red-50 border-red-200"
      }`}
    >
      {result.message}
    </p>
  );
}

export function DrawingForm({ structures }: { structures: DrawingStructureOption[] }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [structureId, setStructureId] = useState("");
  const [pending, startTransition] = useTransition();

  const elements = structures.find((s) => s.id === structureId)?.elements ?? [];

  return (
    <form
      action={(fd) => startTransition(async () => setResult(await createDrawing(fd)))}
      className="space-y-3 max-w-lg"
    >
      <ResultBanner result={result} />
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="Çizim Tipi">
          <select name="drawingType" className={inputClass} defaultValue="SHOP_DRAWING">
            <option value="IFC">IFC</option>
            <option value="SHOP_DRAWING">Shop Drawing</option>
            <option value="DIGER">Diğer</option>
          </select>
        </Field>
        <Field label="Çizim Kodu" required>
          <input name="code" required placeholder="örn. VIA11-P05-REB" className={inputClass} />
        </Field>
      </div>
      <Field label="Başlık" required>
        <input name="title" required className={inputClass} />
      </Field>
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded-md text-sm font-semibold bg-blue-700 hover:bg-blue-800 text-white disabled:opacity-50"
      >
        {pending ? "Kaydediliyor…" : "Çizim Ekle"}
      </button>
    </form>
  );
}

export function AddRevisionForm({ drawingId }: { drawingId: string }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => startTransition(async () => setResult(await addRevision(fd)))}
      className="flex gap-2 items-end flex-wrap"
    >
      <input type="hidden" name="drawingId" value={drawingId} />
      <label>
        <span className="block text-xs font-medium text-gray-600 mb-1">Revizyon</span>
        <input
          name="revisionCode"
          required
          placeholder="Rev.05"
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-24"
        />
      </label>
      <label>
        <span className="block text-xs font-medium text-gray-600 mb-1">Durum</span>
        <select
          name="status"
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
          defaultValue="INCELEMEDE"
        >
          <option value="TASLAK">Taslak</option>
          <option value="INCELEMEDE">İncelemede</option>
          <option value="ONAYLI">Onaylı</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-700 text-white disabled:opacity-50"
      >
        Revizyon Ekle
      </button>
      {result && (
        <span
          className={`text-xs px-2 py-1 rounded ${
            result.ok ? "text-green-800 bg-green-50" : "text-red-800 bg-red-50"
          }`}
        >
          {result.message}
        </span>
      )}
    </form>
  );
}

export function RevisionStatusButtons({
  revisionId,
  status,
}: {
  revisionId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const set = (newStatus: string) => {
    const fd = new FormData();
    fd.set("revisionId", revisionId);
    fd.set("status", newStatus);
    startTransition(async () => setResult(await updateRevisionStatus(fd)));
  };

  if (status === "ONAYLI" || status === "SUPERSEDED") return null;
  return (
    <span className="inline-flex gap-1 items-center">
      <button
        onClick={() => set("ONAYLI")}
        disabled={pending}
        className="px-2 py-0.5 rounded text-xs font-medium bg-green-700 hover:bg-green-800 text-white disabled:opacity-50"
      >
        Onayla
      </button>
      <button
        onClick={() => set("REDDEDILDI")}
        disabled={pending}
        className="px-2 py-0.5 rounded text-xs font-medium bg-red-700 hover:bg-red-800 text-white disabled:opacity-50"
      >
        Reddet
      </button>
      {result && !result.ok && <span className="text-xs text-red-700">{result.message}</span>}
    </span>
  );
}

export function SiteUsedForm({
  elementId,
  drawingId,
  revisions,
  currentRevisionId,
}: {
  elementId: string;
  drawingId: string;
  revisions: { id: string; code: string }[];
  currentRevisionId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <form
      action={(fd) => startTransition(async () => setResult(await setSiteUsedRevision(fd)))}
      className="flex gap-1 items-center"
    >
      <input type="hidden" name="elementId" value={elementId} />
      <input type="hidden" name="drawingId" value={drawingId} />
      <select
        name="revisionId"
        defaultValue={currentRevisionId ?? ""}
        className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
      >
        <option value="" disabled>
          Seçin…
        </option>
        {revisions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.code}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="px-2 py-1 rounded text-xs font-medium bg-gray-700 hover:bg-gray-800 text-white disabled:opacity-50"
      >
        Kaydet
      </button>
      {result && !result.ok && <span className="text-xs text-red-700">{result.message}</span>}
    </form>
  );
}
