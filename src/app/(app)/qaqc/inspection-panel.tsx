"use client";
// ITP kontrol sonucu giriş paneli — QA/QC (Survey checkpoint'leri Survey'e ait).
import { useState, useTransition } from "react";
import { recordInspection } from "@/app/actions/qaqc";
import type { ActionResult } from "@/app/actions/piles";

const RESULT_OPTIONS: { value: string; label: string; cls: string }[] = [
  { value: "GECTI", label: "Geçti", cls: "bg-green-600 hover:bg-green-700 text-white" },
  { value: "SARTLI_GECTI", label: "Şartlı Geçti", cls: "bg-amber-500 hover:bg-amber-600 text-white" },
  { value: "KALDI", label: "Kaldı", cls: "bg-red-600 hover:bg-red-700 text-white" },
];

export function InspectionButtons({
  checkpointId,
  elementId,
  currentResult,
}: {
  checkpointId: string;
  elementId: string;
  currentResult: string;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const record = (value: string) => {
    const fd = new FormData();
    fd.set("checkpointId", checkpointId);
    fd.set("elementId", elementId);
    fd.set("result", value);
    startTransition(async () => {
      setResult(await recordInspection(fd));
    });
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {RESULT_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => record(opt.value)}
          disabled={pending}
          className={`px-2 py-1 rounded text-xs font-medium disabled:opacity-50 ${
            currentResult === opt.value ? opt.cls : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
      {result && !result.ok && (
        <span className="text-xs text-red-700 bg-red-50 rounded px-2 py-1">{result.message}</span>
      )}
    </div>
  );
}
