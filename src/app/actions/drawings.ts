"use server";
// Çizim/revizyon action'ları (madde 21). Yalnızca Teknik Ofis + Yönetici.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertPermission, YetkiHatasi } from "@/lib/permissions";
import { logChanges } from "@/lib/audit";
import { DrawingType, RevisionStatus } from "@prisma/client";
import type { ActionResult } from "@/app/actions/piles";

export async function createDrawing(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "drawing", "create");

    const schema = z.object({
      structureId: z.string().min(1, "Yapı seçilmelidir."),
      elementId: z.string().optional(),
      drawingType: z.nativeEnum(DrawingType),
      code: z.string().min(2, "Çizim kodu en az 2 karakter olmalıdır."),
      title: z.string().min(2, "Başlık en az 2 karakter olmalıdır."),
    });
    const parsed = schema.safeParse({
      structureId: formData.get("structureId"),
      elementId: formData.get("elementId") || undefined,
      drawingType: formData.get("drawingType") ?? "SHOP_DRAWING",
      code: formData.get("code"),
      title: formData.get("title"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
    }
    const d = parsed.data;

    if (await prisma.drawing.findUnique({ where: { code: d.code } })) {
      return { ok: false, message: `"${d.code}" kodlu çizim zaten kayıtlı.` };
    }

    await prisma.drawing.create({
      data: {
        structureId: d.structureId,
        elementId: d.elementId,
        drawingType: d.drawingType,
        code: d.code,
        title: d.title,
      },
    });

    revalidatePath("/cizimler");
    return { ok: true, message: "Çizim kaydedildi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

export async function addRevision(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "drawing", "update");

    const schema = z.object({
      drawingId: z.string().min(1),
      revisionCode: z.string().min(1, "Revizyon kodu zorunludur."),
      status: z.nativeEnum(RevisionStatus),
    });
    const parsed = schema.safeParse({
      drawingId: formData.get("drawingId"),
      revisionCode: formData.get("revisionCode"),
      status: formData.get("status") ?? "TASLAK",
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
    }
    const d = parsed.data;

    const drawing = await prisma.drawing.findUnique({ where: { id: d.drawingId } });
    if (!drawing) return { ok: false, message: "Çizim bulunamadı." };

    const dup = await prisma.drawingRevision.findUnique({
      where: { drawingId_revisionCode: { drawingId: d.drawingId, revisionCode: d.revisionCode } },
    });
    if (dup) return { ok: false, message: `${d.revisionCode} revizyonu zaten kayıtlı.` };

    await prisma.$transaction(async (tx) => {
      // Yeni revizyon ONAYLI ise eski onaylıları SUPERSEDED yap (tek onaylı revizyon kuralı)
      if (d.status === "ONAYLI") {
        await tx.drawingRevision.updateMany({
          where: { drawingId: d.drawingId, status: "ONAYLI" },
          data: { status: "SUPERSEDED" },
        });
      }
      const rev = await tx.drawingRevision.create({
        data: {
          drawingId: d.drawingId,
          revisionCode: d.revisionCode,
          status: d.status,
          ...(d.status === "ONAYLI" ? { approvedDate: new Date() } : {}),
        },
      });
      await logChanges(tx, {
        entityType: "DrawingRevision",
        entityId: rev.id,
        before: { status: null },
        after: { status: d.status, revisionCode: d.revisionCode },
        changedById: session.user.id,
      });
    });

    revalidatePath("/cizimler");
    return { ok: true, message: "Revizyon eklendi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

export async function updateRevisionStatus(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "drawing", "update");

    const schema = z.object({
      revisionId: z.string().min(1),
      status: z.nativeEnum(RevisionStatus),
    });
    const parsed = schema.safeParse({
      revisionId: formData.get("revisionId"),
      status: formData.get("status"),
    });
    if (!parsed.success) return { ok: false, message: "Geçersiz veri gönderildi." };
    const { revisionId, status } = parsed.data;

    const rev = await prisma.drawingRevision.findUnique({ where: { id: revisionId } });
    if (!rev) return { ok: false, message: "Revizyon bulunamadı." };

    await prisma.$transaction(async (tx) => {
      if (status === "ONAYLI") {
        await tx.drawingRevision.updateMany({
          where: { drawingId: rev.drawingId, status: "ONAYLI", id: { not: revisionId } },
          data: { status: "SUPERSEDED" },
        });
      }
      await tx.drawingRevision.update({
        where: { id: revisionId },
        data: { status, ...(status === "ONAYLI" ? { approvedDate: new Date() } : {}) },
      });
      await logChanges(tx, {
        entityType: "DrawingRevision",
        entityId: revisionId,
        before: { status: rev.status },
        after: { status },
        changedById: session.user.id,
      });
    });

    revalidatePath("/cizimler");
    return { ok: true, message: "Revizyon durumu güncellendi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

/** Sahada kullanılan revizyonu kaydet — uyuşmazlık uyarısının veri kaynağı (madde 21). */
export async function setSiteUsedRevision(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    // Saha da teknik ofis de işaretleyebilir: element update yetkisi yeterli.
    await assertPermission(session.user.role, "element", "update");

    const schema = z.object({
      elementId: z.string().min(1),
      drawingId: z.string().min(1),
      revisionId: z.string().min(1),
    });
    const parsed = schema.safeParse({
      elementId: formData.get("elementId"),
      drawingId: formData.get("drawingId"),
      revisionId: formData.get("revisionId"),
    });
    if (!parsed.success) return { ok: false, message: "Geçersiz veri gönderildi." };
    const { elementId, drawingId, revisionId } = parsed.data;

    const rev = await prisma.drawingRevision.findUnique({ where: { id: revisionId } });
    if (!rev || rev.drawingId !== drawingId)
      return { ok: false, message: "Revizyon bu çizime ait değil." };

    const existing = await prisma.elementDrawingUsage.findUnique({
      where: { elementId_drawingId: { elementId, drawingId } },
    });

    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.elementDrawingUsage.update({
          where: { id: existing.id },
          data: { siteUsedRevisionId: revisionId },
        });
        await logChanges(tx, {
          entityType: "ElementDrawingUsage",
          entityId: existing.id,
          before: { siteUsedRevisionId: existing.siteUsedRevisionId },
          after: { siteUsedRevisionId: revisionId },
          changedById: session.user.id,
        });
      } else {
        await tx.elementDrawingUsage.create({
          data: { elementId, drawingId, siteUsedRevisionId: revisionId },
        });
      }
    });

    revalidatePath("/cizimler");
    return { ok: true, message: "Sahada kullanılan revizyon kaydedildi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}
