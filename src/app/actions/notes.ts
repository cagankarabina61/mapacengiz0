"use server";
// Kullanıcı notu server action'ları (katmanlı düzenleme).
//
// İLKE: not eklemek sistemin ürettiği hiçbir metni değiştirmez, gizlemez veya
// bastırmaz. Not her zaman üretilen içeriğin ÜSTÜNE binen ayrı bir katmandır.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertPermission, YetkiHatasi } from "@/lib/permissions";
import { writeNoteInTx } from "@/lib/notes";
import { safeRevalidate } from "@/lib/revalidate";
import { canEditNote, NOT_AUTHOR_MESSAGE } from "@/lib/logic/note-rules";
import type { ActionResult } from "@/app/actions/piles";

const BODY_MAX = 2000;

const createSchema = z.object({
  entityType: z.string().min(1).max(64),
  entityId: z.string().min(1).max(128),
  anchorKey: z.string().max(64).optional(),
  body: z.string().trim().min(1, "Not boş olamaz.").max(BODY_MAX, "Not çok uzun."),
  from: z.string().optional(),
});

export async function createNote(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "note", "create");

    const parsed = createSchema.safeParse({
      entityType: formData.get("entityType"),
      entityId: formData.get("entityId"),
      anchorKey: formData.get("anchorKey") || undefined,
      body: formData.get("body"),
      from: formData.get("from") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
    }
    const d = parsed.data;

    await writeNoteInTx(prisma, {
      entityType: d.entityType,
      entityId: d.entityId,
      body: d.body,
      authorId: session.user.id,
      anchorKey: d.anchorKey,
    });

    safeRevalidate(d.from);
    return { ok: true, message: "Not eklendi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

const updateSchema = z.object({
  noteId: z.string().min(1),
  body: z.string().trim().min(1, "Not boş olamaz.").max(BODY_MAX, "Not çok uzun."),
  from: z.string().optional(),
});

export async function updateNote(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "note", "update");

    const parsed = updateSchema.safeParse({
      noteId: formData.get("noteId"),
      body: formData.get("body"),
      from: formData.get("from") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
    }
    const { noteId, body, from } = parsed.data;

    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note) return { ok: false, message: "Not bulunamadı." };
    // Yetki, sahipliği kapsamaz — ayrıca denetlenir.
    if (!canEditNote(note, session.user)) return { ok: false, message: NOT_AUTHOR_MESSAGE };

    await prisma.note.update({
      where: { id: noteId },
      data: { body, editedAt: new Date() },
    });

    safeRevalidate(from);
    return { ok: true, message: "Not güncellendi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

const idSchema = z.object({
  noteId: z.string().min(1),
  from: z.string().optional(),
});

/** Notu çözüldü olarak işaretler — silmez, listeden düşürür. */
export async function resolveNote(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "note", "update");

    const parsed = idSchema.safeParse({
      noteId: formData.get("noteId"),
      from: formData.get("from") || undefined,
    });
    if (!parsed.success) return { ok: false, message: "Geçersiz veri gönderildi." };

    const note = await prisma.note.findUnique({ where: { id: parsed.data.noteId } });
    if (!note) return { ok: false, message: "Not bulunamadı." };
    if (!canEditNote(note, session.user)) return { ok: false, message: NOT_AUTHOR_MESSAGE };

    await prisma.note.update({
      where: { id: parsed.data.noteId },
      data: { status: "COZULDU", resolvedAt: new Date(), resolvedById: session.user.id },
    });

    safeRevalidate(parsed.data.from);
    return { ok: true, message: "Not çözüldü olarak işaretlendi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

/** Yumuşak silme (madde 56) — kayıt fiziksel olarak kalır, iz korunur. */
export async function deleteNote(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "note", "delete");

    const parsed = idSchema.safeParse({
      noteId: formData.get("noteId"),
      from: formData.get("from") || undefined,
    });
    if (!parsed.success) return { ok: false, message: "Geçersiz veri gönderildi." };

    const note = await prisma.note.findUnique({ where: { id: parsed.data.noteId } });
    if (!note) return { ok: false, message: "Not bulunamadı." };
    if (!canEditNote(note, session.user)) return { ok: false, message: NOT_AUTHOR_MESSAGE };

    await prisma.note.update({
      where: { id: parsed.data.noteId },
      data: { deletedAt: new Date() },
    });

    safeRevalidate(parsed.data.from);
    return { ok: true, message: "Not silindi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}
