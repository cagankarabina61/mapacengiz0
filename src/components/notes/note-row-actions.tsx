"use client";
// Tek bir notun düzenle / çözüldü işlemleri. Yalnızca notun yazarına
// (veya yöneticiye) render edilir — canEdit sunucuda hesaplanır.
import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { updateNote, resolveNote } from "@/app/actions/notes";
import { inputClass, buttonPrimary, buttonSecondary } from "@/components/ui";
import type { ActionResult } from "@/app/actions/piles";

export function NoteRowActions({ noteId, body }: { noteId: string; body: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const pathname = usePathname();

  function run(action: (fd: FormData) => Promise<ActionResult>, extra?: (fd: FormData) => void) {
    const fd = new FormData();
    fd.set("noteId", noteId);
    fd.set("from", pathname);
    extra?.(fd);
    start(async () => {
      const r = await action(fd);
      setResult(r);
      if (r.ok) setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="mt-1.5">
        <textarea
          className={inputClass}
          rows={3}
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              run(updateNote, (fd) => fd.set("body", draft));
            }
          }}
        />
        <div className="flex gap-2 mt-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(updateNote, (fd) => fd.set("body", draft))}
            className={`${buttonPrimary} text-xs px-3`}
          >
            {pending ? "…" : "Kaydet"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setEditing(false);
              setDraft(body);
              setResult(null);
            }}
            className={`${buttonSecondary} text-xs px-3`}
          >
            Vazgeç
          </button>
        </div>
        {result && !result.ok && <p className="text-xs text-red-700 mt-1">{result.message}</p>}
      </div>
    );
  }

  return (
    <div className="flex gap-3 mt-0.5">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center min-h-11 text-[11px] text-blue-700 hover:underline"
      >
        Düzenle
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(resolveNote)}
        className="inline-flex items-center min-h-11 text-[11px] text-gray-600 hover:underline"
      >
        {pending ? "…" : "Çözüldü"}
      </button>
      {result && !result.ok && (
        <span className="self-center text-[11px] text-red-700">{result.message}</span>
      )}
    </div>
  );
}
