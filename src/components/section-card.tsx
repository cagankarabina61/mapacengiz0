// Bölüm kabuğu — SUNUCU bileşeni.
//
// Card'ı sarar ve her bölüme şunları verir: kalıcı bir sectionKey, not şeridi,
// opsiyonel "Düzenle" bağlantısı ve mobil katlama.
//
// Sunucu bileşeni olduğu için onEdit callback'i ALAMAZ. İki kaçış yolu:
//   1. editHref — URL sürücülü düzenleme modu (uygulama zaten %100 böyle)
//   2. actions  — sayfa önceden render edilmiş bir istemci adası geçer
//
// NOT: Card'ın kendi title prop'u kullanılmaz; aksiyonların başlıkla aynı
// satırda olması gerekiyor. Card'a dokunulmadı — 154 mevcut kullanım aynen çalışır.
import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { CollapsibleBody } from "@/components/collapsible-body";
import { NoteStrip } from "@/components/notes/note-strip";
import { SECTION_ENTITY_TYPE, sectionTitle, type SectionKey } from "@/lib/sections";
import type { NoteView } from "@/lib/services/notes";

export function SectionCard({
  sectionKey,
  title,
  children,
  actions,
  editHref,
  editLabel = "Düzenle",
  notesEntityType = SECTION_ENTITY_TYPE,
  notesEntityId,
  notes = [],
  canWriteNote,
  collapsible = false,
  defaultOpenOnMobile = true,
  className = "",
}: {
  /** Bölümün kalıcı kimliği; not anahtarı olarak kullanılır. */
  sectionKey: SectionKey;
  /** Verilmezse SECTIONS kaydındaki başlık kullanılır. */
  title?: string;
  children: ReactNode;
  /** Ek kontroller — istemci adası geçilebilir. */
  actions?: ReactNode;
  /** Yalnızca gerçekten düzenlenebilir bir kaydı olan bölümlere verilir. */
  editHref?: string;
  editLabel?: string;
  notesEntityType?: string;
  /** Varsayılan: sectionKey. */
  notesEntityId?: string;
  /** Sayfanın toplu sorgusundan gelen notlar. */
  notes?: NoteView[];
  canWriteNote: boolean;
  collapsible?: boolean;
  defaultOpenOnMobile?: boolean;
  className?: string;
}) {
  const entityId = notesEntityId ?? sectionKey;
  const heading = title ?? sectionTitle(sectionKey);

  const body = (
    <>
      {children}
      <NoteStrip
        notes={notes}
        entityType={notesEntityType}
        entityId={entityId}
        canWrite={canWriteNote}
        addLabel="+ Bölüme not ekle"
      />
    </>
  );

  return (
    <Card className={className}>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h2 className="text-sm font-semibold text-slate-800 tracking-tight">{heading}</h2>
        <div className="flex items-center gap-2 ml-auto">
          {actions}
          {editHref && (
            <Link
              href={editHref}
              className="inline-flex items-center min-h-11 px-1 text-xs font-medium text-blue-700 hover:underline"
            >
              {editLabel}
            </Link>
          )}
        </div>
      </div>
      {collapsible ? (
        <CollapsibleBody defaultOpen={defaultOpenOnMobile}>{body}</CollapsibleBody>
      ) : (
        body
      )}
    </Card>
  );
}
