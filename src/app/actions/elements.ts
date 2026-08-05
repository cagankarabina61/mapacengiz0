"use server";
// Yapı elemanı yönetimi (§49/§52/§57/§58).
// Kullanıcı pier numarasını kendisi girer; sistem sabit bir pier sayısı dayatmaz.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertPermission, YetkiHatasi } from "@/lib/permissions";
import { logChanges } from "@/lib/audit";
import { getElementDependencies, describeDependencies } from "@/lib/services/dependencies";
import {
  buildElementCode,
  buildChildCode,
  buildPileCode,
  buildSegmentCode,
} from "@/lib/logic/structure-codes";
import { buildPierSetupPreview, type PierSetupPreview } from "@/lib/logic/pier-setup";
import type { ElementType } from "@prisma/client";
import type { ActionResult } from "@/app/actions/piles";

const createSchema = z.object({
  structureId: z.string().min(1, "Yapı seçilmelidir."),
  elementType: z.enum(["PIER", "ABUTMENT"]),
  number: z.coerce.number().int().positive("Numara pozitif bir tam sayı olmalıdır."),
});

/** Tek eleman (Pier N / Abutment N) ekler. Aynı numara varsa Türkçe hata döner (§58). */
export async function createElement(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "element", "create");

    const parsed = createSchema.safeParse({
      structureId: formData.get("structureId"),
      elementType: formData.get("elementType") || "PIER",
      number: formData.get("number"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
    }
    const { structureId, elementType, number } = parsed.data;

    const structure = await prisma.structure.findUnique({ where: { id: structureId } });
    if (!structure) return { ok: false, message: "Yapı bulunamadı." };

    const code = buildElementCode(structure.code, elementType, number);
    const label = elementType === "PIER" ? `Pier ${number}` : `Abutment ${number}`;

    const existing = await prisma.structureElement.findUnique({ where: { code } });
    if (existing) {
      return {
        ok: false,
        message: `${label} zaten kayıtlı (${code})${existing.archivedAt ? " — arşivli" : ""}.`,
      };
    }

    const maxSeq = await prisma.structureElement.aggregate({
      where: { structureId, parentId: null },
      _max: { sequenceIndex: true },
    });

    await prisma.$transaction(async (tx) => {
      const element = await tx.structureElement.create({
        data: {
          structureId,
          code,
          name: label,
          elementType: elementType as ElementType,
          sequenceIndex: (maxSeq._max.sequenceIndex ?? -1) + 1,
          status: "PLANLANMADI",
        },
      });
      await logChanges(tx, {
        entityType: "StructureElement",
        entityId: element.id,
        before: { code: null },
        after: { code, elementType, name: label },
        changedById: session.user.id,
      });
    });

    revalidatePath(`/yapilar/${encodeURIComponent(structure.code)}`);
    return { ok: true, message: `${label} eklendi (${code}).` };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

// ── Toplu pier kurulumu (§52) ─────────────────────────────────────────────

const pierSetupSchema = z.object({
  structureId: z.string().min(1, "Yapı seçilmelidir."),
  pierNumber: z.coerce.number().int().positive("Pier numarası pozitif olmalıdır."),
  pileCount: z.coerce.number().int().min(0, "Kazık sayısı negatif olamaz.").max(200),
  pileDiameterMm: z.coerce.number().int().positive().optional(),
  pileDesignLengthM: z.coerce.number().positive().optional(),
  hasBalancedCantilever: z.coerce.boolean().optional(),
  segmentCount: z.coerce.number().int().min(0).max(60).optional(),
  createActivities: z.coerce.boolean().optional(),
});

function parsePierSetup(formData: FormData) {
  return pierSetupSchema.safeParse({
    structureId: formData.get("structureId"),
    pierNumber: formData.get("pierNumber"),
    pileCount: formData.get("pileCount") || 0,
    pileDiameterMm: formData.get("pileDiameterMm") || undefined,
    pileDesignLengthM: formData.get("pileDesignLengthM") || undefined,
    hasBalancedCantilever: formData.get("hasBalancedCantilever") === "on",
    segmentCount: formData.get("segmentCount") || undefined,
    createActivities: formData.get("createActivities") === "on",
  });
}

/** Şablon adım adlarını DB'den okur. Şablon yoksa boş dizi — varsayım üretilmez. */
async function loadTemplateSteps() {
  const [pileCapTpl, pierBodyTpl] = await Promise.all([
    prisma.activityTemplate.findUnique({
      where: { elementType: "PILE_CAP" },
      include: { steps: { orderBy: { sequenceOrder: "asc" } } },
    }),
    prisma.activityTemplate.findUnique({
      where: { elementType: "PIER_GOVDESI" },
      include: { steps: { orderBy: { sequenceOrder: "asc" } } },
    }),
  ]);
  return {
    pileCap: pileCapTpl?.steps.map((s) => s.name) ?? [],
    pierBody: pierBodyTpl?.steps.map((s) => s.name) ?? [],
    pileCapSteps: pileCapTpl?.steps ?? [],
    pierBodySteps: pierBodyTpl?.steps ?? [],
  };
}

export interface PierSetupPreviewResult {
  ok: boolean;
  message: string;
  preview: PierSetupPreview | null;
}

/** ÖNİZLEME — hiçbir şey yazmaz (§52: kaydedilmeden önce görülebilmeli). */
export async function previewPierSetup(formData: FormData): Promise<PierSetupPreviewResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "element", "create");

    const parsed = parsePierSetup(formData);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz veri.", preview: null };
    }
    const d = parsed.data;

    const structure = await prisma.structure.findUnique({ where: { id: d.structureId } });
    if (!structure) return { ok: false, message: "Yapı bulunamadı.", preview: null };

    const pierCode = buildElementCode(structure.code, "PIER", d.pierNumber);
    const existing = await prisma.structureElement.findUnique({ where: { code: pierCode } });
    if (existing) {
      return {
        ok: false,
        message: `Pier ${d.pierNumber} bu yapıda zaten kayıtlı (${pierCode}).`,
        preview: null,
      };
    }

    const steps = await loadTemplateSteps();
    const preview = buildPierSetupPreview(
      {
        structureCode: structure.code,
        pierNumber: d.pierNumber,
        pileCount: d.pileCount,
        pileDiameterMm: d.pileDiameterMm ?? null,
        pileDesignLengthM: d.pileDesignLengthM ?? null,
        hasBalancedCantilever: !!d.hasBalancedCantilever,
        segmentCount: d.segmentCount,
        createActivities: !!d.createActivities,
      },
      { pileCap: steps.pileCap, pierBody: steps.pierBody }
    );

    return {
      ok: true,
      message: `${preview.total} kayıt oluşturulacak. Onaylamadan hiçbir şey kaydedilmez.`,
      preview,
    };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message, preview: null };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu.", preview: null };
  }
}

/** ONAY SONRASI — önizlemedeki kayıtları tek transaction içinde oluşturur (§52). */
export async function createPierSetup(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "element", "create");

    const parsed = parsePierSetup(formData);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
    }
    const d = parsed.data;

    const structure = await prisma.structure.findUnique({ where: { id: d.structureId } });
    if (!structure) return { ok: false, message: "Yapı bulunamadı." };

    const pierCode = buildElementCode(structure.code, "PIER", d.pierNumber);
    // Önizleme sonrası başkası eklemiş olabilir — sunucu tarafında yeniden doğrula
    if (await prisma.structureElement.findUnique({ where: { code: pierCode } })) {
      return { ok: false, message: `Pier ${d.pierNumber} bu yapıda zaten kayıtlı (${pierCode}).` };
    }

    const steps = await loadTemplateSteps();
    const maxSeq = await prisma.structureElement.aggregate({
      where: { structureId: d.structureId, parentId: null },
      _max: { sequenceIndex: true },
    });

    let created = 0;
    await prisma.$transaction(async (tx) => {
      // 1) Pier
      const pier = await tx.structureElement.create({
        data: {
          structureId: d.structureId,
          code: pierCode,
          name: `Pier ${d.pierNumber}`,
          elementType: "PIER",
          sequenceIndex: (maxSeq._max.sequenceIndex ?? -1) + 1,
          status: "PLANLANMADI",
        },
      });
      created++;

      // 2) Alt elemanlar
      const pileCap = await tx.structureElement.create({
        data: {
          structureId: d.structureId,
          parentId: pier.id,
          code: buildChildCode(pierCode, "PC"),
          name: `Pier ${d.pierNumber} Pile Cap`,
          elementType: "PILE_CAP",
          status: "PLANLANMADI",
        },
      });
      const pierBody = await tx.structureElement.create({
        data: {
          structureId: d.structureId,
          parentId: pier.id,
          code: buildChildCode(pierCode, "PIER"),
          name: `Pier ${d.pierNumber} Gövdesi`,
          elementType: "PIER_GOVDESI",
          status: "PLANLANMADI",
        },
      });
      created += 2;

      // 3) Kazık grubu + kazıklar
      if (d.pileCount > 0) {
        const group = await tx.pileGroup.create({
          data: {
            elementId: pier.id,
            name: `Pier ${d.pierNumber} Kazık Grubu`,
            designPileCount: d.pileCount,
          },
        });
        created++;
        await tx.pile.createMany({
          data: Array.from({ length: d.pileCount }, (_, i) => ({
            pileGroupId: group.id,
            code: buildPileCode(pierCode, i + 1),
            diameterMm: d.pileDiameterMm ?? null,
            designLengthM: d.pileDesignLengthM ?? null,
            status: "PLANLANDI" as const,
          })),
        });
        created += d.pileCount;
      }

      // 4) İş kalemleri (şablondan, bağımlılık zinciriyle)
      if (d.createActivities) {
        for (const [elementId, tplSteps] of [
          [pileCap.id, steps.pileCapSteps] as const,
          [pierBody.id, steps.pierBodySteps] as const,
        ]) {
          let prevId: string | null = null;
          for (const step of tplSteps) {
            const act = await tx.activity.create({
              data: {
                elementId,
                activityType: step.activityType,
                name: step.name,
                sequenceIndex: step.sequenceOrder,
                status: "PLANLANMADI",
              },
            });
            created++;
            if (prevId) {
              await tx.dependency.create({
                data: { predecessorActivityId: prevId, successorActivityId: act.id },
              });
            }
            prevId = act.id;
          }
        }
      }

      // 5) Dengeli konsol segmentleri
      const segCount = d.segmentCount ?? 0;
      if (d.hasBalancedCantilever && segCount > 0) {
        for (const side of ["SOL", "SAG"] as const) {
          for (let n = 0; n <= segCount; n++) {
            await tx.balancedCantileverSegment.create({
              data: {
                pierElementId: pierBody.id,
                code: buildSegmentCode(pierCode, side, n),
                segmentNumber: n,
                side,
                status: "PLANLANMADI",
              },
            });
            created++;
          }
        }
        // Yapıda dengeli konsol varsa sekmenin açılması için bayrağı işaretle (§44)
        await tx.structure.update({
          where: { id: d.structureId },
          data: { hasBalancedCantilever: true },
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "StructureElement",
          entityId: pier.id,
          fieldName: "pierSetup",
          oldValue: null,
          newValue: `${pierCode} kurulumu: ${created} kayıt oluşturuldu`,
          changedById: session.user.id,
        },
      });
    });

    revalidatePath(`/yapilar/${encodeURIComponent(structure.code)}`);
    revalidatePath("/kazik");
    revalidatePath("/segmentler");
    return { ok: true, message: `Pier ${d.pierNumber} kuruldu — ${created} kayıt oluşturuldu.` };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

// ── Arşivleme / silme (§49/§57) ───────────────────────────────────────────

/** Elemanın bağımlılık özetini döner — UI onay metni için (§49). */
export async function checkElementDependencies(elementId: string) {
  const deps = await getElementDependencies(elementId);
  return { ...deps, description: describeDependencies(deps) };
}

/** Elemanı arşivler. Bağlı kayıtlar korunur, eleman aktif listelerden gizlenir (§49). */
export async function archiveElement(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "element", "update");

    const elementId = String(formData.get("elementId") ?? "");
    const reason = String(formData.get("reason") ?? "").trim() || "Gerekçe belirtilmedi";

    const element = await prisma.structureElement.findUnique({
      where: { id: elementId },
      include: { structure: true, children: true },
    });
    if (!element) return { ok: false, message: "Eleman bulunamadı." };
    if (element.archivedAt) return { ok: false, message: "Bu eleman zaten arşivli." };

    const childIds = element.children.map((c) => c.id);

    await prisma.$transaction(async (tx) => {
      // Eleman ve alt elemanları birlikte arşivlenir (yetim alt eleman kalmasın)
      await tx.structureElement.updateMany({
        where: { id: { in: [elementId, ...childIds] } },
        data: { archivedAt: new Date(), archivedById: session.user.id, archiveReason: reason },
      });
      await logChanges(tx, {
        entityType: "StructureElement",
        entityId: elementId,
        before: { archivedAt: null },
        after: { archivedAt: new Date() },
        changedById: session.user.id,
        reason,
      });
    });

    revalidatePath(`/yapilar/${encodeURIComponent(element.structure.code)}`);
    const extra = childIds.length > 0 ? ` (${childIds.length} alt eleman dahil)` : "";
    return { ok: true, message: `${element.name} arşivlendi${extra}. Verileri korunuyor.` };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

export async function unarchiveElement(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "element", "update");

    const elementId = String(formData.get("elementId") ?? "");
    const element = await prisma.structureElement.findUnique({
      where: { id: elementId },
      include: { structure: true, children: true },
    });
    if (!element) return { ok: false, message: "Eleman bulunamadı." };

    await prisma.$transaction(async (tx) => {
      await tx.structureElement.updateMany({
        where: { id: { in: [elementId, ...element.children.map((c) => c.id)] } },
        data: { archivedAt: null, archivedById: null, archiveReason: null },
      });
      await logChanges(tx, {
        entityType: "StructureElement",
        entityId: elementId,
        before: { archivedAt: element.archivedAt },
        after: { archivedAt: null },
        changedById: session.user.id,
      });
    });

    revalidatePath(`/yapilar/${encodeURIComponent(element.structure.code)}`);
    return { ok: true, message: `${element.name} arşivden çıkarıldı.` };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

/** Fiziksel siler — YALNIZCA hiç bağlı kaydı olmayan eleman için (§49/§57). */
export async function deleteElement(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "element", "delete");

    const elementId = String(formData.get("elementId") ?? "");
    const element = await prisma.structureElement.findUnique({
      where: { id: elementId },
      include: { structure: true },
    });
    if (!element) return { ok: false, message: "Eleman bulunamadı." };

    const deps = await getElementDependencies(elementId);
    if (!deps.canDelete) {
      return {
        ok: false,
        message: `${element.name} silinemez. ${describeDependencies(deps)} Bunun yerine arşivleyin.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          entityType: "StructureElement",
          entityId: elementId,
          fieldName: "delete",
          oldValue: `${element.code} — ${element.name}`,
          newValue: null,
          changedById: session.user.id,
          reason: "Bağlı kaydı olmayan eleman silindi",
        },
      });
      await tx.structureElement.delete({ where: { id: elementId } });
    });

    revalidatePath(`/yapilar/${encodeURIComponent(element.structure.code)}`);
    return { ok: true, message: `${element.name} silindi (bağlı kaydı yoktu).` };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}
