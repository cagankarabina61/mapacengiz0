// Not sahiplik kuralları (saf — prisma import etmez).
//
// Bu kurallar RBAC'ın ÜSTÜNDE çalışır: "note:update" izni yeteneği verir,
// başkasının notunu düzenleme hakkını değil. İki denetim de geçilmelidir.
import type { RoleName } from "@prisma/client";

export interface NoteOwnership {
  authorId: string;
  deletedAt: Date | null;
}

export interface NoteViewer {
  id: string;
  role: RoleName;
}

/**
 * Bir notu kim düzenleyebilir/silebilir?
 * • Yazarının kendisi
 * • Yönetici (herkesinkini)
 * Yumuşak silinmiş not kimse tarafından düzenlenemez.
 * İzleyici hiçbir koşulda düzenleyemez — zaten not oluşturamaz da.
 */
export function canEditNote(note: NoteOwnership, viewer: NoteViewer): boolean {
  if (note.deletedAt !== null) return false;
  if (viewer.role === "IZLEYICI") return false;
  if (viewer.role === "YONETICI") return true;
  return note.authorId === viewer.id;
}

export interface AttentionItemOwnership {
  createdById: string;
}

/**
 * Elle eklenen dikkat kalemini kim düzenleyebilir/kapatabilir?
 * Notlarla aynı kural. Sistem kalemleri bu fonksiyona hiç uğramaz —
 * onlar kapatılamaz, yalnızca not eklenebilir.
 */
export function canEditAttentionItem(
  item: AttentionItemOwnership,
  viewer: NoteViewer
): boolean {
  if (viewer.role === "IZLEYICI") return false;
  if (viewer.role === "YONETICI") return true;
  return item.createdById === viewer.id;
}

export const NOT_AUTHOR_MESSAGE = "Bu notu yalnızca yazarı düzenleyebilir.";
export const NOT_ITEM_AUTHOR_MESSAGE = "Bu kalemi yalnızca ekleyen kişi düzenleyebilir.";
