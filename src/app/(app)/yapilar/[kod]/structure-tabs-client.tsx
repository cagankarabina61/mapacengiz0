"use client";
// Yapı detay sayfası etkileşimli bileşenleri (§49/§50/§51/§52).
import { useState, useTransition } from "react";
import {
  updateStructure,
  archiveStructure,
  unarchiveStructure,
  deleteStructure,
} from "@/app/actions/structures";
import {
  createElement,
  previewPierSetup,
  createPierSetup,
  archiveElement,
  unarchiveElement,
  deleteElement,
} from "@/app/actions/elements";
import { updateSegmentPlan, createSegments } from "@/app/actions/segments";
import type { ActionResult } from "@/app/actions/piles";
import type { PierSetupPreview } from "@/lib/logic/pier-setup";
import { Field, inputClass, Badge } from "@/components/ui";
import { STRUCTURE_TYPE_LABELS } from "@/lib/labels";

function Result({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p
      className={`text-sm px-3 py-2 rounded border mt-2 ${
        result.ok
          ? "text-green-800 bg-green-50 border-green-200"
          : "text-red-800 bg-red-50 border-red-200"
      }`}
    >
      {result.message}
    </p>
  );
}

// ── Genel sekmesi: yapı düzenleme (§50) ───────────────────────────────────

export function StructureEditForm({
  structure,
}: {
  structure: {
    id: string;
    name: string;
    type: string;
    hasBalancedCantilever: boolean;
    startChainage: string | null;
    endChainage: string | null;
  };
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => startTransition(async () => setResult(await updateStructure(fd)))}
      className="grid gap-3 md:grid-cols-2 max-w-3xl"
    >
      <input type="hidden" name="structureId" value={structure.id} />
      <Field label="Yapı Adı" required>
        <input name="name" required defaultValue={structure.name} className={inputClass} />
      </Field>
      <Field label="Yapı Tipi" required>
        <select name="type" defaultValue={structure.type} className={inputClass}>
          {Object.entries(STRUCTURE_TYPE_LABELS).map(([value, lbl]) => (
            <option key={value} value={value}>
              {lbl}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Başlangıç Kilometrajı">
        <input
          name="startChainage"
          defaultValue={structure.startChainage ?? ""}
          className={inputClass}
        />
      </Field>
      <Field label="Bitiş Kilometrajı">
        <input name="endChainage" defaultValue={structure.endChainage ?? ""} className={inputClass} />
      </Field>
      <div className="md:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="hasBalancedCantilever"
            defaultChecked={structure.hasBalancedCantilever}
            className="w-4 h-4"
          />
          Dengeli konsol var — işaretlenirse &quot;Dengeli Konsol&quot; sekmesi görünür
        </label>
      </div>
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-md text-sm font-semibold bg-blue-700 hover:bg-blue-800 text-white disabled:opacity-50"
        >
          {pending ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}
        </button>
        <Result result={result} />
      </div>
    </form>
  );
}

// ── Genel sekmesi: arşivle / sil (§51) ────────────────────────────────────

export function StructureDangerZone({
  structureId,
  archived,
  archiveReason,
  dependencyText,
  canDelete,
}: {
  structureId: string;
  archived: boolean;
  archiveReason: string | null;
  dependencyText: string;
  canDelete: boolean;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: (fd: FormData) => Promise<ActionResult>, fd: FormData) => {
    startTransition(async () => setResult(await fn(fd)));
  };

  if (archived) {
    return (
      <div>
        <p className="text-sm text-gray-700 mb-2">
          Bu yapı arşivli. {archiveReason ? `Gerekçe: ${archiveReason}` : ""}
        </p>
        <form
          action={(fd) => run(unarchiveStructure, fd)}
          className="inline"
        >
          <input type="hidden" name="structureId" value={structureId} />
          <button
            type="submit"
            disabled={pending}
            className="px-4 py-2 rounded-md text-sm font-medium bg-slate-700 hover:bg-slate-800 text-white disabled:opacity-50"
          >
            Arşivden Çıkar
          </button>
        </form>
        <Result result={result} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700">{dependencyText}</p>

      <form action={(fd) => run(archiveStructure, fd)} className="space-y-2">
        <input type="hidden" name="structureId" value={structureId} />
        <input
          name="reason"
          required
          placeholder="Arşivleme gerekçesi (zorunlu)"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-md text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
        >
          Arşivle (veriler korunur)
        </button>
      </form>

      <form action={(fd) => run(deleteStructure, fd)}>
        <input type="hidden" name="structureId" value={structureId} />
        <button
          type="submit"
          disabled={pending || !canDelete}
          title={
            canDelete
              ? "Bu yapıya bağlı kayıt yok, güvenle silinebilir."
              : "Bağlı kayıtları olan yapı silinemez — arşivleyin."
          }
          className="px-4 py-2 rounded-md text-sm font-medium bg-red-700 hover:bg-red-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Kalıcı Sil
        </button>
        {!canDelete && (
          <p className="text-xs text-gray-500 mt-1">
            Bağlı kayıtları olan yapı kalıcı olarak silinemez. Bunun yerine arşivleyin.
          </p>
        )}
      </form>
      <Result result={result} />
    </div>
  );
}

// ── Elemanlar sekmesi: basit ekleme ───────────────────────────────────────

export function AddElementForm({ structureId }: { structureId: string }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => startTransition(async () => setResult(await createElement(fd)))}
      className="flex items-end gap-2 flex-wrap"
    >
      <input type="hidden" name="structureId" value={structureId} />
      <label className="block">
        <span className="block text-xs font-medium text-gray-600 mb-1">Eleman Tipi</span>
        <select name="elementType" defaultValue="PIER" className={`${inputClass} w-32`}>
          <option value="PIER">Pier</option>
          <option value="ABUTMENT">Abutment</option>
        </select>
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-gray-600 mb-1">Numara</span>
        <input
          name="number"
          type="number"
          min="1"
          step="1"
          required
          placeholder="örn. 3"
          className={`${inputClass} w-24`}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded-md text-sm font-medium bg-blue-700 hover:bg-blue-800 text-white disabled:opacity-50"
      >
        {pending ? "Ekleniyor…" : "Ekle"}
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
    </form>
  );
}

// ── Elemanlar sekmesi: gelişmiş pier kurulumu, önizlemeli (§52) ───────────

export function PierSetupForm({ structureId }: { structureId: string }) {
  const [preview, setPreview] = useState<PierSetupPreview | null>(null);
  const [formSnapshot, setFormSnapshot] = useState<FormData | null>(null);
  const [message, setMessage] = useState<ActionResult | null>(null);
  const [hasBC, setHasBC] = useState(false);
  const [pending, startTransition] = useTransition();

  const doPreview = (formData: FormData) => {
    startTransition(async () => {
      const res = await previewPierSetup(formData);
      setPreview(res.preview);
      setMessage({ ok: res.ok, message: res.message });
      setFormSnapshot(res.ok ? formData : null);
    });
  };

  const doConfirm = () => {
    if (!formSnapshot) return;
    startTransition(async () => {
      const res = await createPierSetup(formSnapshot);
      setMessage(res);
      if (res.ok) {
        setPreview(null);
        setFormSnapshot(null);
      }
    });
  };

  return (
    <div className="space-y-3">
      <form action={doPreview} className="grid gap-3 md:grid-cols-3 max-w-4xl">
        <input type="hidden" name="structureId" value={structureId} />
        <Field label="Pier No" required>
          <input name="pierNumber" type="number" min="1" required className={inputClass} />
        </Field>
        <Field label="Kazık Sayısı">
          <input name="pileCount" type="number" min="0" defaultValue={0} className={inputClass} />
        </Field>
        <Field label="Kazık Çapı (mm)">
          <input name="pileDiameterMm" type="number" min="1" className={inputClass} />
        </Field>
        <Field label="Kazık Tasarım Boyu (m)">
          <input name="pileDesignLengthM" type="number" step="0.1" min="0.1" className={inputClass} />
        </Field>
        <div className="flex items-end pb-2 gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="hasBalancedCantilever"
              className="w-4 h-4"
              checked={hasBC}
              onChange={(e) => setHasBC(e.target.checked)}
            />
            Dengeli konsol
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="createActivities" defaultChecked className="w-4 h-4" />
            İş kalemleri
          </label>
        </div>
        {hasBC && (
          <Field label="Segment Sayısı (taraf başına)">
            <input name="segmentCount" type="number" min="1" max="60" className={inputClass} />
          </Field>
        )}
        <div className="md:col-span-3">
          <button
            type="submit"
            disabled={pending}
            className="px-4 py-2 rounded-md text-sm font-semibold bg-slate-800 hover:bg-slate-900 text-white disabled:opacity-50"
          >
            {pending ? "Hesaplanıyor…" : "Önizle"}
          </button>
          <span className="text-xs text-gray-500 ml-2">
            Onaylamadan hiçbir kayıt oluşturulmaz.
          </span>
        </div>
      </form>

      <Result result={message} />

      {preview && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
          <p className="text-sm font-semibold text-blue-900">
            Önizleme — {preview.pierCode} için {preview.total} kayıt oluşturulacak
          </p>
          <div className="flex gap-2 flex-wrap mt-2">
            {preview.summary.map((s) => (
              <Badge key={s.category} tone="blue">
                {s.category}: {s.count}
              </Badge>
            ))}
          </div>

          {preview.warnings.length > 0 && (
            <ul className="mt-2 text-xs text-amber-900 list-disc ml-5">
              {preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          <details className="mt-2">
            <summary className="text-xs text-blue-800 cursor-pointer">
              Oluşturulacak kayıtların tam listesi ({preview.records.length})
            </summary>
            <div className="max-h-64 overflow-y-auto mt-2 bg-white rounded border border-blue-200">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-gray-100">
                  {preview.records.map((r, i) => (
                    <tr key={i}>
                      <td className="py-1 px-2 text-gray-500 w-40">{r.category}</td>
                      <td className="py-1 px-2 font-medium">{r.name}</td>
                      <td className="py-1 px-2 text-gray-400">{r.code}</td>
                      <td className="py-1 px-2 text-gray-500">{r.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <button
            onClick={doConfirm}
            disabled={pending}
            className="mt-3 px-4 py-2 rounded-md text-sm font-semibold bg-green-700 hover:bg-green-800 text-white disabled:opacity-50"
          >
            {pending ? "Oluşturuluyor…" : `Onayla ve ${preview.total} Kaydı Oluştur`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Elemanlar sekmesi: satır bazlı arşivle/sil (§49/§57) ──────────────────

export function ElementActions({
  elementId,
  elementName,
  archived,
  dependencyText,
  canDelete,
}: {
  elementId: string;
  elementName: string;
  archived: boolean;
  dependencyText: string;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: (fd: FormData) => Promise<ActionResult>, fd: FormData) => {
    startTransition(async () => setResult(await fn(fd)));
  };

  if (archived) {
    return (
      <div className="text-right">
        <form action={(fd) => run(unarchiveElement, fd)} className="inline">
          <input type="hidden" name="elementId" value={elementId} />
          <button
            type="submit"
            disabled={pending}
            className="px-2 py-1 rounded text-xs font-medium bg-slate-700 hover:bg-slate-800 text-white disabled:opacity-50"
          >
            Arşivden Çıkar
          </button>
        </form>
        {result && <p className="text-xs mt-1 text-gray-600">{result.message}</p>}
      </div>
    );
  }

  return (
    <div className="text-right">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-2 py-1 rounded text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700"
      >
        {open ? "Kapat" : "Kaldır…"}
      </button>

      {open && (
        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded text-left space-y-2">
          <p className="text-xs text-gray-800">
            <strong>{elementName}</strong> — {dependencyText}
          </p>
          <form action={(fd) => run(archiveElement, fd)} className="space-y-2">
            <input type="hidden" name="elementId" value={elementId} />
            <input
              name="reason"
              placeholder="Arşivleme gerekçesi"
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
            />
            <button
              type="submit"
              disabled={pending}
              className="px-3 py-1.5 rounded text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
            >
              Arşivle (veriler korunur)
            </button>
          </form>
          <form action={(fd) => run(deleteElement, fd)}>
            <input type="hidden" name="elementId" value={elementId} />
            <button
              type="submit"
              disabled={pending || !canDelete}
              title={
                canDelete
                  ? "Bağlı kayıt yok, güvenle silinebilir."
                  : "Bağlı kayıtları olan eleman silinemez — arşivleyin."
              }
              className="px-3 py-1.5 rounded text-xs font-medium bg-red-700 hover:bg-red-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Kalıcı Sil
            </button>
          </form>
          {result && (
            <p
              className={`text-xs px-2 py-1 rounded ${
                result.ok ? "text-green-800 bg-green-100" : "text-red-800 bg-red-100"
              }`}
            >
              {result.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dengeli Konsol sekmesi: operasyonel plan (§47/§48) ────────────────────

export interface SegmentPlanRow {
  id: string;
  code: string;
  label: string;
  pierName: string;
  plannedDate: string | null;
  plannedEnd: string | null;
  pumpResourceId: string | null;
  crewResourceId: string | null;
  responsibleUserId: string | null;
  status: string;
}

export function SegmentPlanForm({
  segment,
  pumps,
  crews,
  engineers,
}: {
  segment: SegmentPlanRow;
  pumps: { id: string; label: string }[];
  crews: { id: string; label: string }[];
  engineers: { id: string; label: string }[];
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => startTransition(async () => setResult(await updateSegmentPlan(fd)))}
      className="flex items-end gap-2 flex-wrap"
    >
      <input type="hidden" name="segmentId" value={segment.id} />
      <label className="block">
        <span className="block text-[10px] font-medium text-gray-500 mb-0.5">Planlanan</span>
        <input
          name="plannedDate"
          type="date"
          defaultValue={segment.plannedDate ?? ""}
          className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
        />
      </label>
      <label className="block">
        <span className="block text-[10px] font-medium text-gray-500 mb-0.5">Bitiş</span>
        <input
          name="plannedEnd"
          type="date"
          defaultValue={segment.plannedEnd ?? ""}
          className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
        />
      </label>
      <label className="block">
        <span className="block text-[10px] font-medium text-gray-500 mb-0.5">Pompa</span>
        <select
          name="pumpResourceId"
          defaultValue={segment.pumpResourceId ?? ""}
          className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
        >
          <option value="">—</option>
          {pumps.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="block text-[10px] font-medium text-gray-500 mb-0.5">Ekip</span>
        <select
          name="crewResourceId"
          defaultValue={segment.crewResourceId ?? ""}
          className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
        >
          <option value="">—</option>
          {crews.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="block text-[10px] font-medium text-gray-500 mb-0.5">Sorumlu</span>
        <select
          name="responsibleUserId"
          defaultValue={segment.responsibleUserId ?? ""}
          className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
        >
          <option value="">—</option>
          {engineers.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="px-3 py-1.5 rounded text-xs font-medium bg-blue-700 hover:bg-blue-800 text-white disabled:opacity-50"
      >
        {pending ? "…" : "Kaydet"}
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

/** Bir pier'e toplu segment ekleme (§52). */
export function AddSegmentsForm({ piers }: { piers: { id: string; name: string }[] }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (piers.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Segment eklemek için önce bu yapıya pier eklemelisiniz (Elemanlar sekmesi).
      </p>
    );
  }

  return (
    <form
      action={(fd) => startTransition(async () => setResult(await createSegments(fd)))}
      className="flex items-end gap-2 flex-wrap"
    >
      <label className="block">
        <span className="block text-xs font-medium text-gray-600 mb-1">Pier</span>
        <select name="pierElementId" required className={`${inputClass} w-56`} defaultValue="">
          <option value="" disabled>
            Pier seçin…
          </option>
          {piers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-gray-600 mb-1">Taraf</span>
        <select name="side" defaultValue="SOL" className={`${inputClass} w-28`}>
          <option value="SOL">Sol</option>
          <option value="SAG">Sağ</option>
          <option value="TEK">Tek</option>
        </select>
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-gray-600 mb-1">Başlangıç No</span>
        <input
          name="fromNumber"
          type="number"
          min="0"
          defaultValue={0}
          className={`${inputClass} w-24`}
        />
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-gray-600 mb-1">Bitiş No</span>
        <input name="toNumber" type="number" min="0" required className={`${inputClass} w-24`} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded-md text-sm font-medium bg-blue-700 hover:bg-blue-800 text-white disabled:opacity-50"
      >
        {pending ? "Ekleniyor…" : "Segment Ekle"}
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
    </form>
  );
}
