"use client";
// Kazık tablosu: tekli + toplu güncelleme (madde 36), anlamlı Türkçe hata mesajları (madde 63).
import { useState, useTransition } from "react";
import { bulkUpdatePileStatus, type ActionResult } from "@/app/actions/piles";
import { StatusBadge } from "@/components/ui";
import { PILE_STATUS_LABELS, PILE_TEST_STATUS_LABELS, PILE_ACCEPTANCE_LABELS, UNSPECIFIED, label } from "@/lib/labels";

export interface PileRow {
  id: string;
  code: string;
  status: string;
  diameterMm: number | null;
  designLengthM: string | null;
  concreteClass: string | null;
  testStatus: string;
  acceptanceStatus: string;
  groupName: string;
  problemDescription: string | null;
}

const STATUS_OPTIONS = Object.entries(PILE_STATUS_LABELS);

export function PileTable({ piles }: { piles: PileRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("DELGI_TAMAMLANDI");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === piles.length ? new Set() : new Set(piles.map((p) => p.id))));
  };

  const applyBulk = () => {
    const fd = new FormData();
    for (const id of selected) fd.append("pileIds", id);
    fd.set("status", bulkStatus);
    startTransition(async () => {
      const res = await bulkUpdatePileStatus(fd);
      setResult(res);
      if (res.ok) setSelected(new Set());
    });
  };

  return (
    <div className="space-y-3">
      {/* Toplu işlem çubuğu */}
      <div className="flex items-center gap-2 flex-wrap bg-white border border-gray-200 rounded-lg p-3">
        <span className="text-sm text-gray-600">{selected.size} kazık seçili</span>
        <select
          value={bulkStatus}
          onChange={(e) => setBulkStatus(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
        >
          {STATUS_OPTIONS.map(([value, lbl]) => (
            <option key={value} value={value}>
              {lbl}
            </option>
          ))}
        </select>
        <button
          onClick={applyBulk}
          disabled={selected.size === 0 || pending}
          className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-700 text-white disabled:opacity-50"
        >
          {pending ? "Güncelleniyor…" : "Seçilenleri Güncelle"}
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

      <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-300 text-left">
              <th className="py-2 px-2">
                <input
                  type="checkbox"
                  checked={selected.size === piles.length && piles.length > 0}
                  onChange={toggleAll}
                  className="w-4 h-4"
                />
              </th>
              <th className="py-2 px-2 font-semibold text-gray-600">Kazık</th>
              <th className="py-2 px-2 font-semibold text-gray-600">Grup</th>
              <th className="py-2 px-2 font-semibold text-gray-600">Çap</th>
              <th className="py-2 px-2 font-semibold text-gray-600">Boy</th>
              <th className="py-2 px-2 font-semibold text-gray-600">Beton</th>
              <th className="py-2 px-2 font-semibold text-gray-600">Durum</th>
              <th className="py-2 px-2 font-semibold text-gray-600">Test</th>
              <th className="py-2 px-2 font-semibold text-gray-600">Kabul</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {piles.map((p) => (
              <tr key={p.id} className={selected.has(p.id) ? "bg-blue-50" : "hover:bg-gray-50"}>
                <td className="py-2 px-2">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="w-4 h-4"
                  />
                </td>
                <td className="py-2 px-2 font-medium whitespace-nowrap">
                  {p.code}
                  {p.problemDescription && (
                    <p className="text-xs text-red-700 font-normal">{p.problemDescription}</p>
                  )}
                </td>
                <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{p.groupName}</td>
                <td className="py-2 px-2 whitespace-nowrap">
                  {p.diameterMm ? `${p.diameterMm} mm` : UNSPECIFIED}
                </td>
                <td className="py-2 px-2 whitespace-nowrap">
                  {p.designLengthM ? `${p.designLengthM} m` : UNSPECIFIED}
                </td>
                <td className="py-2 px-2 whitespace-nowrap">{p.concreteClass ?? UNSPECIFIED}</td>
                <td className="py-2 px-2">
                  <StatusBadge status={p.status} labelText={label(PILE_STATUS_LABELS, p.status)} />
                </td>
                <td className="py-2 px-2">
                  <StatusBadge
                    status={p.testStatus}
                    labelText={label(PILE_TEST_STATUS_LABELS, p.testStatus)}
                  />
                </td>
                <td className="py-2 px-2">
                  <StatusBadge
                    status={p.acceptanceStatus}
                    labelText={label(PILE_ACCEPTANCE_LABELS, p.acceptanceStatus)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
