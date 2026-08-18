"use server";
// Elle eklenen dikkat kalemi server action'ları.
//
// ÖNEMLİ: Bu action'lar YALNIZCA kullanıcının kendi eklediği kalemleri yönetir.
// Sistemin ürettiği dikkat kalemleri gizlenemez, ertelenemez veya kapatılamaz —
// onlara yalnızca not eklenebilir (bkz. src/app/actions/notes.ts).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertPermission, YetkiHatasi } from "@/lib/permissions";
import { safeRevalidate } from "@/lib/revalidate";
import { validUntilFor } from "@/lib/logic/attention";
import { canEditAttentionItem, NOT_ITEM_AUTHOR_MESSAGE } from "@/lib/logic/note-rules";
import { AttentionLevel } from "@prisma/client";
import type { ActionResult } from "@/app/actions/piles";

/** Çok satırlı metin alanını madde listesine çevirir (boş satırlar atılır). */
function toLines(raw: FormDataEntryValue | null): string[] {
  if (!raw) return [];
  return String(raw)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 10);
}

const createSchema = z.object({
  label: z.string().trim().min(3, "Başlık en az 3 karakter olmalıdır.").max(200),
  detail: z.string().trim().max(500).optional(),
  level: z.nativeEnum(AttentionLevel),
  validity: z.enum(["BUGUN", "YARIN", "SURESIZ"]),
  structureCode: z.string().trim().max(40).optional(),
  responsible: z.string().trim().max(120).optional(),
  from: z.string().optional(),
});

export async function createAttentionItem(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "attentionItem", "create");

    const parsed = createSchema.safeParse({
      label: formData.get("label"),
      detail: formData.get("detail") || undefined,
      level: formData.get("level") ?? "ORTA",
      validity: formData.get("validity") ?? "BUGUN",
      structureCode: formData.get("structureCode") || undefined,
      responsible: formData.get("responsible") || undefined,
      from: formData.get("from") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
    }
    const d = parsed.data;

    const now = new Date();
    await prisma.userAttentionItem.create({
      data: {
        label: d.label,
        detail: d.detail,
        reasons: toLines(formData.get("reasons")),
        nextActions: toLines(formData.get("nextActions")),
        level: d.level,
        structureCode: d.structureCode,
        responsible: d.responsible,
        validFrom: now,
        validUntil: validUntilFor(d.validity, now),
        createdById: session.user.id,
      },
    });

    safeRevalidate(d.from);
    return { ok: true, message: "Dikkat kalemi eklendi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

const updateSchema = createSchema.extend({ itemId: z.string().min(1) });

export async function updateAttentionItem(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "attentionItem", "update");

    const parsed = updateSchema.safeParse({
      itemId: formData.get("itemId"),
      label: formData.get("label"),
      detail: formData.get("detail") || undefined,
      level: formData.get("level") ?? "ORTA",
      validity: formData.get("validity") ?? "BUGUN",
      structureCode: formData.get("structureCode") || undefined,
      responsible: formData.get("responsible") || undefined,
      from: formData.get("from") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
    }
    const d = parsed.data;

    const item = await prisma.userAttentionItem.findUnique({ where: { id: d.itemId } });
    if (!item) return { ok: false, message: "Dikkat kalemi bulunamadı." };
    if (!canEditAttentionItem(item, session.user)) {
      return { ok: false, message: NOT_ITEM_AUTHOR_MESSAGE };
    }

    await prisma.userAttentionItem.update({
      where: { id: d.itemId },
      data: {
        label: d.label,
        detail: d.detail,
        reasons: toLines(formData.get("reasons")),
        nextActions: toLines(formData.get("nextActions")),
        level: d.level,
        structureCode: d.structureCode,
        responsible: d.responsible,
        validUntil: validUntilFor(d.validity, item.validFrom),
      },
    });

    safeRevalidate(d.from);
    return { ok: true, message: "Dikkat kalemi güncellendi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

const resolveSchema = z.object({
  itemId: z.string().min(1),
  resolutionNote: z.string().trim().max(500).optional(),
  from: z.string().optional(),
});

/** Kullanıcının KENDİ eklediği kalemi kapatır. Sistem kalemleri için yolu yoktur. */
export async function resolveAttentionItem(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "attentionItem", "update");

    const parsed = resolveSchema.safeParse({
      itemId: formData.get("itemId"),
      resolutionNote: formData.get("resolutionNote") || undefined,
      from: formData.get("from") || undefined,
    });
    if (!parsed.success) return { ok: false, message: "Geçersiz veri gönderildi." };
    const d = parsed.data;

    const item = await prisma.userAttentionItem.findUnique({ where: { id: d.itemId } });
    if (!item) return { ok: false, message: "Dikkat kalemi bulunamadı." };
    if (!canEditAttentionItem(item, session.user)) {
      return { ok: false, message: NOT_ITEM_AUTHOR_MESSAGE };
    }

    await prisma.userAttentionItem.update({
      where: { id: d.itemId },
      data: {
        status: "COZULDU",
        resolutionNote: d.resolutionNote,
        resolvedAt: new Date(),
        resolvedById: session.user.id,
      },
    });

    safeRevalidate(d.from);
    return { ok: true, message: "Kalem kapatıldı." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}
