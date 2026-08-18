// Not şeridi — SUNUCU bileşeni, saf çıktı.
//
// Görsel ayrım bilinçlidir: notlar KEHRİBAR sol kenarlıkla basılır, sistemin
// dikkat kalemleri KIRMIZI ile. Kullanıcı katmanı, üretilen içerikten bakışta
// ayırt edilebilir olmalı — mevcut "Override: {isim} — {tarih}" rozetinin
// kurduğu köken disiplininin aynısı.
import { NoteComposer } from "@/components/notes/note-composer";
import { NoteRowActions } from "@/components/notes/note-row-actions";
import type { NoteView } from "@/lib/services/notes";

function formatWhen(d: Date): string {
  return d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

export function NoteStrip({
  notes,
  entityType,
  entityId,
  anchorKey,
  canWrite,
  compact = false,
  addLabel,
}: {
  notes: NoteView[];
  entityType: string;
  entityId: string;
  anchorKey?: string;
  canWrite: boolean;
  /** Kart içi kullanım — üst ayraç ve boşluk azaltılır. */
  compact?: boolean;
  addLabel?: string;
}) {
  if (notes.length === 0 && !canWrite) return null;

  return (
    <div className={compact ? "mt-1.5" : "mt-3 pt-3 border-t border-gray-100"}>
      {notes.length > 0 && (
        <ul className="space-y-1.5 mb-1.5">
          {notes.map((n) => (
            <li
              key={n.id}
              className="text-xs bg-amber-50/80 border-l-[3px] border-amber-400 ring-1 ring-inset ring-amber-100 rounded-md px-2.5 py-2"
            >
              <p className="text-gray-800 whitespace-pre-wrap break-words">{n.body}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {n.authorName} · {formatWhen(n.createdAt)}
                {n.editedAt && " · düzenlendi"}
                {n.isEditReason && " · düzenleme gerekçesi"}
              </p>
              {n.canEdit && <NoteRowActions noteId={n.id} body={n.body} />}
            </li>
          ))}
        </ul>
      )}
      {canWrite && (
        <NoteComposer
          entityType={entityType}
          entityId={entityId}
          anchorKey={anchorKey}
          label={addLabel}
        />
      )}
    </div>
  );
}
