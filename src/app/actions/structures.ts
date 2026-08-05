"use server";
// Yapı (VIA/proje) yönetimi (§43/§50/§51/§58).
// Geliştirici müdahalesi veya DB'ye manuel kayıt gerekmez — hepsi UI'dan yapılır.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertPermission, YetkiHatasi } from "@/lib/permissions";
import { logChanges } from "@/lib/audit";
import { getStructureDependencies, describeDependencies } from "@/lib/services/dependencies";
import { normalizeStructureCode, isValidStructureCode } from "@/lib/logic/structure-codes";
import { StructureType } from "@prisma/client";
import type { ActionResult } from "@/app/actions/piles";

const createSchema = z.object({
  code: z.string().min(1, "Yapı kodu zorunludur."),
  name: z.string().min(2, "Yapı adı en az 2 karakter olmalıdır."),
  type: z.nativeEnum(StructureType),
  hasBalancedCantilever: z.coerce.boolean().optional(),
  startChainage: z.string().optional(),
  endChainage: z.string().optional(),
});

/** Yeni yapı/VIA oluşturur (§43). Kod normalize edilir, benzersizliği kontrol edilir (§58). */
export async function createStructure(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "structure", "create");

    const parsed = createSchema.safeParse({
      code: formData.get("code"),
      name: formData.get("name"),
      type: formData.get("type") ?? "VIYADUK",
      hasBalancedCantilever: formData.get("hasBalancedCantilever") === "on",
      startChainage: formData.get("startChainage") || undefined,
      endChainage: formData.get("endChainage") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
    }
    const d = parsed.data;

    const code = normalizeStructureCode(d.code);
    if (!isValidStructureCode(code)) {
      return {
        ok: false,
        message: `"${d.code}" geçerli bir yapı kodu değil. Örnek: VIA-11`,
      };
    }

    // §58: aynı VIA kodu iki kez oluşturulamaz
    const existing = await prisma.structure.findUnique({ where: { code } });
    if (existing) {
      return {
        ok: false,
        message: `${code} kodlu yapı zaten kayıtlı${existing.archivedAt ? " (arşivli)" : ""}.`,
      };
    }

    // Yapılar mevcut projeye bağlanır; proje yoksa oluşturulur.
    let project = await prisma.project.findFirst({ where: { isSample: false } });
    if (!project) {
      project = await prisma.project.create({
        data: { code: "PROJE", name: "Proje", isSample: false },
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const s = await tx.structure.create({
        data: {
          projectId: project.id,
          code,
          name: d.name,
          type: d.type,
          hasBalancedCantilever: !!d.hasBalancedCantilever,
          startChainage: d.startChainage,
          endChainage: d.endChainage,
          isSample: false,
        },
      });
      await logChanges(tx, {
        entityType: "Structure",
        entityId: s.id,
        before: { code: null },
        after: {
          code,
          name: d.name,
          type: d.type,
          hasBalancedCantilever: !!d.hasBalancedCantilever,
        },
        changedById: session.user.id,
      });
      return s;
    });

    revalidatePath("/yapilar");
    return { ok: true, message: `${created.code} oluşturuldu.` };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

const updateSchema = z.object({
  structureId: z.string().min(1),
  name: z.string().min(2, "Yapı adı en az 2 karakter olmalıdır."),
  type: z.nativeEnum(StructureType),
  hasBalancedCantilever: z.coerce.boolean().optional(),
  startChainage: z.string().optional(),
  endChainage: z.string().optional(),
});

/** Yapı bilgilerini günceller (§50). Değişiklikler AuditLog'a yazılır. */
export async function updateStructure(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "structure", "update");

    const parsed = updateSchema.safeParse({
      structureId: formData.get("structureId"),
      name: formData.get("name"),
      type: formData.get("type"),
      hasBalancedCantilever: formData.get("hasBalancedCantilever") === "on",
      startChainage: formData.get("startChainage") || undefined,
      endChainage: formData.get("endChainage") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
    }
    const d = parsed.data;

    const structure = await prisma.structure.findUnique({ where: { id: d.structureId } });
    if (!structure) return { ok: false, message: "Yapı bulunamadı." };

    // Dengeli konsol kapatılıyorsa ve segment varsa kullanıcı bilgilendirilir —
    // veri silinmez, yalnızca sekme gizlenir.
    let extra = "";
    if (structure.hasBalancedCantilever && !d.hasBalancedCantilever) {
      const segCount = await prisma.balancedCantileverSegment.count({
        where: { pierElement: { structureId: d.structureId } },
      });
      if (segCount > 0) {
        extra = ` Not: ${segCount} segment kaydı korunuyor, yalnızca sekme gizlendi.`;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.structure.update({
        where: { id: d.structureId },
        data: {
          name: d.name,
          type: d.type,
          hasBalancedCantilever: !!d.hasBalancedCantilever,
          startChainage: d.startChainage ?? null,
          endChainage: d.endChainage ?? null,
        },
      });
      await logChanges(tx, {
        entityType: "Structure",
        entityId: d.structureId,
        before: {
          name: structure.name,
          type: structure.type,
          hasBalancedCantilever: structure.hasBalancedCantilever,
          startChainage: structure.startChainage,
          endChainage: structure.endChainage,
        },
        after: {
          name: d.name,
          type: d.type,
          hasBalancedCantilever: !!d.hasBalancedCantilever,
          startChainage: d.startChainage ?? null,
          endChainage: d.endChainage ?? null,
        },
        changedById: session.user.id,
      });
    });

    revalidatePath(`/yapilar/${encodeURIComponent(structure.code)}`);
    revalidatePath("/yapilar");
    return { ok: true, message: `${structure.code} güncellendi.${extra}` };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

/** Yapıyı arşivler (§51). Veri silinmez; aktif listelerden gizlenir. */
export async function archiveStructure(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "structure", "update");

    const structureId = String(formData.get("structureId") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    if (!reason) return { ok: false, message: "Arşivleme gerekçesi zorunludur." };

    const structure = await prisma.structure.findUnique({ where: { id: structureId } });
    if (!structure) return { ok: false, message: "Yapı bulunamadı." };
    if (structure.archivedAt) return { ok: false, message: "Bu yapı zaten arşivli." };

    await prisma.$transaction(async (tx) => {
      await tx.structure.update({
        where: { id: structureId },
        data: { archivedAt: new Date(), archivedById: session.user.id, archiveReason: reason },
      });
      await logChanges(tx, {
        entityType: "Structure",
        entityId: structureId,
        before: { archivedAt: null },
        after: { archivedAt: new Date() },
        changedById: session.user.id,
        reason,
      });
    });

    revalidatePath("/yapilar");
    return { ok: true, message: `${structure.code} arşivlendi. Verileri korunuyor.` };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

/** Arşivden çıkarır. */
export async function unarchiveStructure(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "structure", "update");

    const structureId = String(formData.get("structureId") ?? "");
    const structure = await prisma.structure.findUnique({ where: { id: structureId } });
    if (!structure) return { ok: false, message: "Yapı bulunamadı." };

    await prisma.$transaction(async (tx) => {
      await tx.structure.update({
        where: { id: structureId },
        data: { archivedAt: null, archivedById: null, archiveReason: null },
      });
      await logChanges(tx, {
        entityType: "Structure",
        entityId: structureId,
        before: { archivedAt: structure.archivedAt },
        after: { archivedAt: null },
        changedById: session.user.id,
      });
    });

    revalidatePath("/yapilar");
    return { ok: true, message: `${structure.code} arşivden çıkarıldı.` };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

/**
 * Fiziksel siler — YALNIZCA hiç bağlı kaydı olmayan (yanlışlıkla oluşturulmuş) yapı için (§51).
 * Üretim verisi varsa silme reddedilir, kullanıcı arşivlemeye yönlendirilir.
 */
export async function deleteStructure(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "structure", "delete");

    const structureId = String(formData.get("structureId") ?? "");
    const structure = await prisma.structure.findUnique({ where: { id: structureId } });
    if (!structure) return { ok: false, message: "Yapı bulunamadı." };

    const deps = await getStructureDependencies(structureId);
    if (!deps.canDelete) {
      return {
        ok: false,
        message: `${structure.code} silinemez. ${describeDependencies(deps)} Bunun yerine arşivleyin.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          entityType: "Structure",
          entityId: structureId,
          fieldName: "delete",
          oldValue: `${structure.code} — ${structure.name}`,
          newValue: null,
          changedById: session.user.id,
          reason: "Bağlı kaydı olmayan yapı silindi",
        },
      });
      await tx.structure.delete({ where: { id: structureId } });
    });

    revalidatePath("/yapilar");
    return { ok: true, message: `${structure.code} silindi (bağlı kaydı yoktu).` };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}
