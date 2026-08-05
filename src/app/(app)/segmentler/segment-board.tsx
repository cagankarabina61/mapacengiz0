"use client";
// Segment panosu: adım durumlarını tıklayarak ilerletme (Bekliyor → Devam → Tamamlandı).
import { useState, useTransition } from "react";
import { updateSegmentStep } from "@/app/actions/segments";
import type { ActionResult } from "@/app/actions/piles";

const STEPS: { field: string; label: string }[] = [
  { field: "rebarStatus", label: "Donatı" },
  { field: "formworkStatus", label: "Kalıp" },
  { field: "tendonStatus", label: "Tendon" },
  { field: "anchorageStatus", label: "Ankraj" },
  { field: "embeddedItemsStatus", label: "Gömülü" },
  { field: "inspectionStatus", label: "Kontrol" },
  { field: "concreteStatus", label: "Beton" },
  { field: "postTensioningStatus", label: "Post-t." },
  { field: "surveyStatus", label: "Survey" },
  { field: "groutingStatus", label: "Grouting" },
];

const NEXT_VALUE: Record<string, string> = {
  BEKLIYOR: "DEVAM_EDIYOR",
  DEVAM_EDIYOR: "TAMAMLANDI",
  TAMAMLANDI: "BEKLIYOR",
};

export interface SegmentView {
  id: string;
  code: string;
  segmentNumber: number;
  side: string;
  /** null = proje kuralı tanımlı değil → sistem karar üretmez (madde 5). */
  canStart: boolean | null;
  gateExplanation: string;
  missingFromPrevious: string[];
  steps: Record<string, string>;
}

export function SegmentBoard({ segments }: { segments: SegmentView[] }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const advance = (segmentId: string, field: string, current: string) => {
    const fd = new FormData();
    fd.set("segmentId", segmentId);
    fd.set("step", field);
    fd.set("value", NEXT_VALUE[current] ?? "DEVAM_EDIYOR");
    startTransition(async () => {
      setResult(await updateSegmentStep(fd));
    });
  };

  return (
    <div className="space-y-2">
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
      <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-300 text-left">
              <th className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">Segment</th>
              {STEPS.map((s) => (
                <th key={s.field} className="py-2 px-1 font-semibold text-gray-600 text-center">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {segments.map((seg) => (
              <tr key={seg.id} className={seg.canStart === false ? "opacity-60 bg-gray-50" : ""}>
                <td className="py-2 px-2 whitespace-nowrap">
                  <span className="font-medium">
                    {seg.side !== "TEK" ? `${seg.side} ` : ""}S{seg.segmentNumber}
                  </span>
                  {seg.canStart === false && (
                    <p className="text-red-700 text-[10px]" title={seg.gateExplanation}>
                      Önceki segment bekleniyor
                    </p>
                  )}
                  {seg.canStart === null && (
                    <p className="text-amber-700 text-[10px]" title={seg.gateExplanation}>
                      Kural tanımlanmamış
                    </p>
                  )}
                </td>
                {STEPS.map((s) => {
                  const v = seg.steps[s.field];
                  const cls =
                    v === "TAMAMLANDI"
                      ? "bg-green-600 text-white"
                      : v === "DEVAM_EDIYOR"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-500";
                  return (
                    <td key={s.field} className="py-1 px-1 text-center">
                      <button
                        onClick={() => advance(seg.id, s.field, v)}
                        disabled={pending}
                        title={
                          v === "TAMAMLANDI"
                            ? "Tamamlandı (geri almak için tıkla)"
                            : v === "DEVAM_EDIYOR"
                              ? "Devam ediyor (tamamlamak için tıkla)"
                              : "Bekliyor (başlatmak için tıkla)"
                        }
                        className={`w-8 h-8 rounded font-bold ${cls} disabled:cursor-wait`}
                      >
                        {v === "TAMAMLANDI" ? "✓" : v === "DEVAM_EDIYOR" ? "…" : "·"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        · Bekliyor → … Devam Ediyor → ✓ Tamamlandı (hücreye tıklayarak ilerletin)
      </p>
    </div>
  );
}
