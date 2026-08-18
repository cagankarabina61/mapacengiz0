"use client";
// "+ Not" formu — dokununcaya kadar tek butona katlanır.
// Mevcut istemci adası deseni: useState + useTransition + ActionResult.
import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { createNote } from "@/app/actions/notes";
import { inputClass, buttonPrimary, buttonSecondary } from "@/components/ui";
import type { ActionResult } from "@/app/actions/piles";

export function NoteComposer({
  entityType,
  entityId,
  anchorKey,
  label = "+ Not",
  placeholder = "Sahadan not… (ör. pompa 09:00'da gelecek)",
}: {
  entityType: string;
  entityId: string;
  anchorKey?: string;
  label?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const pathname = usePathname();

  function submit() {
    if (!body.trim()) {
      setResult({ ok: false, message: "Not boş olamaz." });
      return;
    }
    const fd = new FormData();
    fd.set("entityType", entityType);
    fd.set("entityId", entityId);
    if (anchorKey) fd.set("anchorKey", anchorKey);
    fd.set("body", body);
    fd.set("from", pathname);
    start(async () => {
      const r = await createNote(fd);
      setResult(r);
      if (r.ok) {
        setBody("");
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setResult(null);
          }}
          className="inline-flex items-center min-h-11 px-2 -ml-2 text-xs font-medium text-blue-700 hover:underline"
        >
          {label}
        </button>
        {result && !result.ok && (
          <p className="text-xs text-red-700 mt-1">{result.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1">
      <textarea
        className={inputClass}
        rows={3}
        value={body}
        autoFocus
        placeholder={placeholder}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          // Ctrl/⌘ + Enter ile gönder — masaüstünde klavyeden çıkmadan.
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
      />
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className={`${buttonPrimary} text-xs px-3`}
        >
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setBody("");
            setResult(null);
          }}
          disabled={pending}
          className={`${buttonSecondary} text-xs px-3`}
        >
          Vazgeç
        </button>
      </div>
      {result && !result.ok && <p className="text-xs text-red-700 mt-1">{result.message}</p>}
    </div>
  );
}
