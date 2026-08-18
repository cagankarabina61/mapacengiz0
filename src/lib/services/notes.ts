// Not okuma servisi.
//
// PERFORMANS KURALI: notlar HER ZAMAN toplu çekilir. getAttentionItems zaten
// kalem başına readiness hesapladığı için (~200 gidiş-dönüş), buraya kalem
// başına bir sorgu daha eklemek listeyi iki katına çıkarırdı.
import { prisma } from "@/lib/db";
import type { RoleName } from "@prisma/client";
import { canEditNote } from "@/lib/logic/note-rules";
import { noteKey, SECTION_ENTITY_TYPE, type SectionKey } from "@/lib/sections";

/** Tek bir notun UI'a taşınan görünümü. */
export interface NoteView {
  id: string;
  body: string;
  authorName: string;
  createdAt: Date;
  editedAt: Date | null;
  isEditReason: boolean;
  anchorKey: string | null;
  /** Sunucuda hesaplanır — istemciye rol/id sızdırmadan buton gösterimi için. */
  canEdit: boolean;
}

export interface NoteViewer {
  id: string;
  role: RoleName;
}

/** Aynı anda gösterilecek not sayısı üst sınırı — sınırsız render edilmez. */
const NOTE_FETCH_LIMIT = 300;

const noteSelect = {
  id: true,
  body: true,
  createdAt: true,
  editedAt: true,
  isEditReason: true,
  anchorKey: true,
  authorId: true,
  deletedAt: true,
  author: { select: { name: true } },
} as const;

type NoteRow = {
  id: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  isEditReason: boolean;
  anchorKey: string | null;
  authorId: string;
  deletedAt: Date | null;
  author: { name: string };
};

function toView(row: NoteRow, viewer: NoteViewer): NoteView {
  return {
    id: row.id,
    body: row.body,
    authorName: row.author.name,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
    isEditReason: row.isEditReason,
    anchorKey: row.anchorKey,
    canEdit: canEditNote({ authorId: row.authorId, deletedAt: row.deletedAt }, viewer),
  };
}

/** Tek bir kaydın/bölümün açık notları. Yalnızca tek kart render eden sayfalar için. */
export async function getNotes(
  entityType: string,
  entityId: string,
  viewer: NoteViewer
): Promise<NoteView[]> {
  const rows = await prisma.note.findMany({
    where: { entityType, entityId, deletedAt: null, status: "ACIK" },
    select: noteSelect,
    orderBy: { createdAt: "asc" },
    take: NOTE_FETCH_LIMIT,
  });
  return rows.map((r) => toView(r, viewer));
}

export interface NoteTarget {
  entityType: string;
  entityId: string;
}

/**
 * Birden çok hedefin notlarını TEK sorguda çeker.
 * Dönen Map'in anahtarı `noteKey(entityType, entityId)` biçimindedir.
 */
export async function getNotesFor(
  targets: NoteTarget[],
  viewer: NoteViewer
): Promise<Map<string, NoteView[]>> {
  const grouped = new Map<string, NoteView[]>();
  if (targets.length === 0) return grouped;

  // Aynı entityType'ları tek OR koşulunda toplayarak sorguyu küçült.
  const byType = new Map<string, string[]>();
  for (const t of targets) {
    const list = byType.get(t.entityType) ?? [];
    list.push(t.entityId);
    byType.set(t.entityType, list);
  }

  const rows = await prisma.note.findMany({
    where: {
      deletedAt: null,
      status: "ACIK",
      OR: [...byType].map(([entityType, ids]) => ({ entityType, entityId: { in: ids } })),
    },
    select: { ...noteSelect, entityType: true, entityId: true },
    orderBy: { createdAt: "asc" },
    take: NOTE_FETCH_LIMIT,
  });

  for (const row of rows) {
    const key = noteKey(row.entityType, row.entityId);
    const list = grouped.get(key) ?? [];
    list.push(toView(row, viewer));
    grouped.set(key, list);
  }
  return grouped;
}

/** Bölüm notları için kısayol — sayfa başına tek sorgu. */
export function getSectionNotes(
  keys: readonly SectionKey[],
  viewer: NoteViewer
): Promise<Map<string, NoteView[]>> {
  return getNotesFor(
    keys.map((k) => ({ entityType: SECTION_ENTITY_TYPE, entityId: k })),
    viewer
  );
}

/**
 * Bir kalem listesine notlarını yerleştirir (tek sorgu).
 * Kalemler `noteEntityType` + `id` ile hedeflenir.
 */
export async function attachNotes<
  T extends { id: string; noteEntityType: string; notes: NoteView[] },
>(items: T[], viewer: NoteViewer): Promise<void> {
  if (items.length === 0) return;
  const grouped = await getNotesFor(
    items.map((i) => ({ entityType: i.noteEntityType, entityId: i.id })),
    viewer
  );
  for (const item of items) {
    item.notes = grouped.get(noteKey(item.noteEntityType, item.id)) ?? [];
  }
}
