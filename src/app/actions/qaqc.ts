"use server";
// QA/QC server action'ları: ITP kontrol sonucu kaydı + NCR yönetimi (tasarım §9, madde 24-25).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertPermission, YetkiHatasi } from "@/lib/permissions";
import { logChanges } from "@/lib/audit";
import { InspectionResult, NCRStatus, NCRImpact } from "@prisma/client";
import type { ActionResult } from "@/app/actions/piles";

/** ITP kontrol sonucu kaydet — yalnızca QA/QC (Survey checkpoint'leri için Survey). */
export async function recordInspection(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();

    const schema = z.object({
      checkpointId: z.string().min(1),
      elementId: z.string().min(1),
      result: z.nativeEnum(InspectionResult),
      notes: z.string().optional(),
    });
    const parsed = schema.safeParse({
      checkpointId: formData.get("checkpointId"),
      elementId: formData.get("elementId"),
      result: formData.get("result"),
      notes: formData.get("notes") || undefined,
    });
    if (!parsed.success) return { ok: false, message: "Geçersiz veri gönderildi." };
    const { checkpointId, elementId, result, notes } = parsed.data;

    const checkpoint = await prisma.iTPCheckpoint.findUnique({ where: { id: checkpointId } });
    if (!checkpoint) return { ok: false, message: "Kontrol noktası bulunamadı." };
    const element = await prisma.structureElement.findUnique({ where: { id: elementId } });
    if (!element) return { ok: false, message: "Yapı elemanı bulunamadı." };

    // Survey kontrolleri Survey rolüne, diğerleri QA/QC'ye ait (madde 39).
    const isSurveyCheckpoint = checkpoint.name.toLocaleLowerCase("tr").includes("survey");
    await assertPermission(
      session.user.role,
      isSurveyCheckpoint ? "surveyRecord" : "inspection",
      "update"
    );

    const existing = await prisma.inspection.findFirst({
      where: { checkpointId, elementId },
    });

    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.inspection.update({
          where: { id: existing.id },
          data: {
            result,
            notes,
            inspectedById: session.user.id,
            inspectedAt: new Date(),
          },
        });
        await logChanges(tx, {
          entityType: "Inspection",
          entityId: existing.id,
          before: { result: existing.result },
          after: { result },
          changedById: session.user.id,
          reason: notes,
        });
      } else {
        const created = await tx.inspection.create({
          data: {
            checkpointId,
            elementId,
            result,
            notes,
            inspectedById: session.user.id,
            inspectedAt: new Date(),
          },
        });
        await logChanges(tx, {
          entityType: "Inspection",
          entityId: created.id,
          before: { result: null },
          after: { result },
          changedById: session.user.id,
          reason: notes,
        });
      }
    });

    revalidatePath("/qaqc");
    revalidatePath("/bloke");
    return { ok: true, message: "Kontrol sonucu kaydedildi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

/** Sıradaki NCR numarası: NCR-YYYY-NNN */
async function nextNcrNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `NCR-${year}-`;
  const last = await prisma.nCR.findFirst({
    where: { ncrNumber: { startsWith: prefix } },
    orderBy: { ncrNumber: "desc" },
    select: { ncrNumber: true },
  });
  const n = last ? parseInt(last.ncrNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(n).padStart(3, "0")}`;
}

export async function createNCR(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "ncr", "create");

    const schema = z.object({
      structureId: z.string().min(1, "Yapı seçilmelidir."),
      elementId: z.string().optional(),
      problemDescription: z.string().min(5, "Problem açıklaması en az 5 karakter olmalıdır."),
      responsibleUserId: z.string().optional(),
      dueDate: z.string().optional(),
      // Madde 7: etki NCR bazında belirlenir
      impact: z.nativeEnum(NCRImpact),
    });
    const parsed = schema.safeParse({
      structureId: formData.get("structureId"),
      elementId: formData.get("elementId") || undefined,
      problemDescription: formData.get("problemDescription"),
      responsibleUserId: formData.get("responsibleUserId") || undefined,
      dueDate: formData.get("dueDate") || undefined,
      impact: formData.get("impact") ?? "UYARI",
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
    }
    const d = parsed.data;

    if (!(await prisma.structure.findUnique({ where: { id: d.structureId } })))
      return { ok: false, message: "Seçilen yapı bulunamadı." };
    if (d.elementId && !(await prisma.structureElement.findUnique({ where: { id: d.elementId } })))
      return { ok: false, message: "Seçilen eleman bulunamadı." };

    const ncrNumber = await nextNcrNumber();
    await prisma.nCR.create({
      data: {
        ncrNumber,
        structureId: d.structureId,
        elementId: d.elementId,
        date: new Date(),
        problemDescription: d.problemDescription,
        responsibleUserId: d.responsibleUserId,
        dueDate: d.dueDate ? new Date(d.dueDate) : undefined,
        status: "ACIK",
        impact: d.impact,
      },
    });

    revalidatePath("/ncr");
    revalidatePath("/bloke");
    return { ok: true, message: `${ncrNumber} oluşturuldu.` };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

export async function updateNCRStatus(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "ncr", "update");

    const schema = z.object({
      ncrId: z.string().min(1),
      status: z.nativeEnum(NCRStatus),
      correctiveAction: z.string().optional(),
    });
    const parsed = schema.safeParse({
      ncrId: formData.get("ncrId"),
      status: formData.get("status"),
      correctiveAction: formData.get("correctiveAction") || undefined,
    });
    if (!parsed.success) return { ok: false, message: "Geçersiz veri gönderildi." };
    const { ncrId, status, correctiveAction } = parsed.data;

    const ncr = await prisma.nCR.findUnique({ where: { id: ncrId } });
    if (!ncr) return { ok: false, message: "NCR bulunamadı." };

    // İş kuralı: düzeltici faaliyet girilmeden NCR kapatılamaz.
    if (status === "KAPATILDI" && !(correctiveAction ?? ncr.correctiveAction)) {
      return { ok: false, message: "Düzeltici faaliyet girilmeden NCR kapatılamaz." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.nCR.update({
        where: { id: ncrId },
        data: {
          status,
          ...(correctiveAction ? { correctiveAction } : {}),
          ...(status === "KAPATILDI" ? { closedDate: new Date() } : {}),
        },
      });
      await logChanges(tx, {
        entityType: "NCR",
        entityId: ncrId,
        before: { status: ncr.status, correctiveAction: ncr.correctiveAction },
        after: { status, correctiveAction: correctiveAction ?? ncr.correctiveAction },
        changedById: session.user.id,
      });
    });

    revalidatePath("/ncr");
    return { ok: true, message: "NCR güncellendi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}
