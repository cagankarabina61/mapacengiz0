"use client";
// Yeni beton dökümü — KADEMELİ seçim (§45/§54): 1) Proje/VIA → 2) Eleman → 3) İmalat.
// Hiyerarşi kullanıcıya açıkça gösterilir; yanlış projeye kayıt riski azaltılır (§46).
import { useState, useTransition } from "react";
import { createPour } from "@/app/actions/pours";
import type { ActionResult } from "@/app/actions/piles";
import { Field, inputClass, Badge } from "@/components/ui";

export interface TargetOption {
  value: string; // "ELEM:id" | "PILE:id" | "SEG:id"
  label: string;
  /** İmalat türü etiketi — 3. kademe filtresi (Pier / Pile Cap / Kazık / Segment...). */
  workType: string;
  /** Bağlı olduğu yapı kodu. */
  structureCode: string;
}

export interface ResourceOption {
  id: string;
  label: string;
}

export interface StructureOption {
  code: string;
  name: string;
}

export function PourForm({
  structures,
  targets,
  pumps,
  crews,
  engineers,
  initialStructure,
}: {
  structures: StructureOption[];
  targets: TargetOption[];
  pumps: ResourceOption[];
  crews: ResourceOption[];
  engineers: ResourceOption[];
  initialStructure?: string;
}) {
  const [structureCode, setStructureCode] = useState(initialStructure ?? "");
  const [workType, setWorkType] = useState("");
  const [target, setTarget] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  // Kademe 2: seçilen yapının hedefleri
  const structureTargets = targets.filter((t) => t.structureCode === structureCode);
  // Kademe 3: bu yapıda mevcut imalat türleri
  const workTypes = [...new Set(structureTargets.map((t) => t.workType))].sort();
  const filteredTargets = workType
    ? structureTargets.filter((t) => t.workType === workType)
    : structureTargets;

  const selectedStructure = structures.find((s) => s.code === structureCode);
  const selectedTarget = targets.find((t) => t.value === target);

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const res = await createPour(formData);
      if (res) setResult(res);
    });
  };

  return (
    <form action={submit} className="space-y-4 max-w-lg">
      {result && !result.ok && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {result.message}
        </p>
      )}

      {/* Seçim özeti — hangi projeye kaydedildiği her an görünür (§46) */}
      {selectedStructure && (
        <div className="text-sm bg-blue-50 border border-blue-200 rounded px-3 py-2">
          <span className="font-medium">{selectedStructure.code}</span>
          <span className="text-gray-600"> — {selectedStructure.name}</span>
          {selectedTarget && (
            <>
              <span className="text-gray-400"> → </span>
              <span className="font-medium">{selectedTarget.label}</span>
              <span className="ml-2">
                <Badge tone="blue">{selectedTarget.workType}</Badge>
              </span>
            </>
          )}
        </div>
      )}

      {/* Kademe 1: Proje / VIA */}
      <Field label="1. Proje / VIA" required>
        <select
          required
          className={inputClass}
          value={structureCode}
          onChange={(e) => {
            setStructureCode(e.target.value);
            setWorkType("");
            setTarget("");
          }}
        >
          <option value="" disabled>
            Proje seçin…
          </option>
          {structures.map((s) => (
            <option key={s.code} value={s.code}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
      </Field>

      {/* Kademe 2: İmalat türü */}
      {structureCode && (
        <Field label="2. İmalat Türü">
          <select
            className={inputClass}
            value={workType}
            onChange={(e) => {
              setWorkType(e.target.value);
              setTarget("");
            }}
          >
            <option value="">Tümü</option>
            {workTypes.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* Kademe 3: Eleman */}
      {structureCode && (
        <Field label="3. Eleman" required>
          <select
            name="target"
            required
            className={inputClass}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="" disabled>
              {filteredTargets.length === 0
                ? "Bu yapıda uygun eleman yok"
                : "Eleman seçin…"}
            </option>
            {filteredTargets.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {structureTargets.length === 0 && (
            <p className="text-xs text-amber-800 mt-1">
              Bu yapıda beton dökülebilecek eleman yok. Önce yapı sayfasından eleman ekleyin.
            </p>
          )}
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tarih" required>
          <input name="plannedDate" type="date" required className={inputClass} />
        </Field>
        <Field label="Saat">
          <input name="plannedTime" type="time" className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Beton Sınıfı">
          <input name="concreteClass" placeholder="örn. C30/37" className={inputClass} />
        </Field>
        <Field label="Planlanan Hacim (m³)" required>
          <input
            name="plannedVolumeM3"
            type="number"
            step="0.1"
            min="0.1"
            required
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Pompa">
          <select name="pumpResourceId" className={inputClass} defaultValue="">
            <option value="">Seçilmedi</option>
            {pumps.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ekip">
          <select name="crewResourceId" className={inputClass} defaultValue="">
            <option value="">Seçilmedi</option>
            {crews.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Sorumlu Mühendis">
          <select name="responsibleUserId" className={inputClass} defaultValue="">
            <option value="">Seçilmedi</option>
            {engineers.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Döküm Süresi (dk)">
          <input
            name="durationMin"
            type="number"
            min="1"
            placeholder="Boş = pompa kapasitesinden"
            className={inputClass}
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={pending || !target}
        className="w-full px-4 py-2.5 rounded-md text-sm font-semibold bg-blue-700 hover:bg-blue-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </button>
    </form>
  );
}
