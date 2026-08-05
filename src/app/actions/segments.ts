"use server";
// Segment adım güncelleme: zincir kapısı korunur (TEST 3 — önceki segment bitmeden başlanamaz).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertPermission, YetkiHatasi } from "@/lib/permissions";
import { logChanges } from "@/lib/audit";
import { canStartNextSegment, type SegmentStepState } from "@/lib/logic/segments";
import { getSegmentGateRule } from "@/lib/services/segments";
import { buildSegmentCode } from "@/lib/logic/structure-codes";
import type { ActionResult } from "@/app/actions/piles";
import { StepStatus } from "@prisma/client";

const STEP_FIELDS = [
  "rebarStatus",
  "formworkStatus",
  "tendonStatus",
  "anchorageStatus",
  "embeddedItemsStatus",
  "inspectionStatus",
  "concreteStatus",
  "postTensioningStatus",
  "surveyStatus",
  "groutingStatus",
] as const;

const schema = z.object({
  segmentId: z.string().min(1),
  step: z.enum(STEP_FIELDS),
  value: z.nativeEnum(StepStatus),
});

function toStepState(s: {
  segmentNumber: number;
  side: "SOL" | "SAG" | "TEK";
  rebarStatus: StepStatus;
  formworkStatus: StepStatus;
  tendonStatus: StepStatus;
  anchorageStatus: StepStatus;
  embeddedItemsStatus: StepStatus;
  inspectionStatus: StepStatus;
  concreteStatus: StepStatus;
  postTensioningStatus: StepStatus;
  surveyStatus: StepStatus;
  groutingStatus: StepStatus;
  requiredConcreteStrengthMPa: unknown;
  achievedConcreteStrengthMPa: unknown;
}): SegmentStepState {
  return {
    ...s,
    requiredConcreteStrengthMPa: s.requiredConcreteStrengthMPa
      ? Number(s.requiredConcreteStrengthMPa)
      : null,
    achievedConcreteStrengthMPa: s.achievedConcreteStrengthMPa
      ? Number(s.achievedConcreteStrengthMPa)
      : null,
  };
}

export async function updateSegmentStep(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "segment", "update");

    const parsed = schema.safeParse({
      segmentId: formData.get("segmentId"),
      step: formData.get("step"),
      value: formData.get("value"),
    });
    if (!parsed.success) return { ok: false, message: "Geçersiz veri gönderildi." };
    const { segmentId, step, value } = parsed.data;

    const segment = await prisma.balancedCantileverSegment.findUnique({
      where: { id: segmentId },
      include: { pierElement: true },
    });
    if (!segment) return { ok: false, message: "Segment bulunamadı." };

    // Zincir kapısı: kural PROJEDEN gelir (madde 5). Kural tanımlı değilse sistem
    // kendi varsayımını dayatmaz — işlem serbest bırakılır, kullanıcı uyarılır.
    if (value !== "BEKLIYOR" && segment.segmentNumber > 0) {
      const previous = await prisma.balancedCantileverSegment.findUnique({
        where: {
          pierElementId_side_segmentNumber: {
            pierElementId: segment.pierElementId,
            side: segment.side,
            segmentNumber: segment.segmentNumber - 1,
          },
        },
      });
      if (previous) {
        const rule = await getSegmentGateRule(segment.pierElement.structureId);
        const gate = canStartNextSegment(toStepState(previous), rule);
        if (gate.ruleDefined && gate.canStart === false) {
          return {
            ok: false,
            message: `Segment ${segment.segmentNumber - 1} proje kuralındaki koşulları sağlamadan Segment ${
              segment.segmentNumber
            } üzerinde çalışılamaz. Eksik: ${gate.missingSteps.join(", ")}.`,
          };
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.balancedCantileverSegment.update({
        where: { id: segmentId },
        data: {
          [step]: value,
          ...(value !== "BEKLIYOR" && segment.status === "PLANLANMADI"
            ? { status: "DEVAM_EDIYOR" as const, actualStart: segment.actualStart ?? new Date() }
            : {}),
        },
      });
      await logChanges(tx, {
        entityType: "BalancedCantileverSegment",
        entityId: segmentId,
        before: { [step]: segment[step] },
        after: { [step]: value },
        changedById: session.user.id,
      });
    });

    revalidatePath("/segmentler");
    return { ok: true, message: "Segment güncellendi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

// ── Operasyonel planlama (§47/§48) ────────────────────────────────────────
// Segment yalnızca mühendislik kaydı değildir; sahadaki işi planlayabilmek için
// tarih + pompa + ekip + sorumlu mühendis bilgisi de tutulur. Bu bilgiler
// günlük plan/look-ahead ekranlarına ve kaynak çakışma motoruna beslenir.

const planSchema = z.object({
  segmentId: z.string().min(1),
  plannedDate: z.string().optional(),
  plannedEnd: z.string().optional(),
  pumpResourceId: z.string().optional(),
  crewResourceId: z.string().optional(),
  responsibleUserId: z.string().optional(),
  notes: z.string().optional(),
});

// VARSAYIM (konfigüre edilebilir): bitiş tarihi girilmezse segment işi 1 gün sürer.
const DEFAULT_SEGMENT_DURATION_DAYS = 1;

export async function updateSegmentPlan(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "segment", "update");

    const parsed = planSchema.safeParse({
      segmentId: formData.get("segmentId"),
      plannedDate: formData.get("plannedDate") || undefined,
      plannedEnd: formData.get("plannedEnd") || undefined,
      pumpResourceId: formData.get("pumpResourceId") || undefined,
      crewResourceId: formData.get("crewResourceId") || undefined,
      responsibleUserId: formData.get("responsibleUserId") || undefined,
      notes: formData.get("notes") || undefined,
    });
    if (!parsed.success) return { ok: false, message: "Geçersiz veri gönderildi." };
    const d = parsed.data;

    const segment = await prisma.balancedCantileverSegment.findUnique({
      where: { id: d.segmentId },
      include: { pierElement: { include: { structure: true } } },
    });
    if (!segment) return { ok: false, message: "Segment bulunamadı." };

    const plannedDate = d.plannedDate ? new Date(d.plannedDate) : null;
    let plannedEnd = d.plannedEnd ? new Date(d.plannedEnd) : null;
    // §58: fiziksel olarak anlamsız değerlere izin verme
    if (plannedDate && plannedEnd && plannedEnd < plannedDate) {
      return { ok: false, message: "Bitiş tarihi başlangıç tarihinden önce olamaz." };
    }
    if (plannedDate && !plannedEnd) {
      plannedEnd = new Date(plannedDate.getTime() + DEFAULT_SEGMENT_DURATION_DAYS * 86400e3);
    }

    await prisma.$transaction(async (tx) => {
      await tx.balancedCantileverSegment.update({
        where: { id: d.segmentId },
        data: {
          plannedDate,
          plannedEnd,
          pumpResourceId: d.pumpResourceId ?? null,
          crewResourceId: d.crewResourceId ?? null,
          responsibleUserId: d.responsibleUserId ?? null,
          notes: d.notes ?? null,
        },
      });

      // Kaynak rezervasyonları — çakışma motorunun veri kaynağı (§48).
      // Segmentin eski rezervasyonları silinip yenileri yazılır.
      await tx.resourceBooking.deleteMany({ where: { segmentId: d.segmentId } });
      if (plannedDate && plannedEnd) {
        for (const resourceId of [d.pumpResourceId, d.crewResourceId]) {
          if (!resourceId) continue;
          await tx.resourceBooking.create({
            data: {
              resourceId,
              targetType: "SEGMENT",
              segmentId: d.segmentId,
              startDateTime: plannedDate,
              endDateTime: plannedEnd,
            },
          });
        }
      }

      await logChanges(tx, {
        entityType: "BalancedCantileverSegment",
        entityId: d.segmentId,
        before: {
          plannedDate: segment.plannedDate,
          pumpResourceId: segment.pumpResourceId,
          crewResourceId: segment.crewResourceId,
          responsibleUserId: segment.responsibleUserId,
        },
        after: {
          plannedDate,
          pumpResourceId: d.pumpResourceId ?? null,
          crewResourceId: d.crewResourceId ?? null,
          responsibleUserId: d.responsibleUserId ?? null,
        },
        changedById: session.user.id,
      });
    });

    revalidatePath("/segmentler");
    revalidatePath(`/yapilar/${encodeURIComponent(segment.pierElement.structure.code)}`);
    revalidatePath("/planlama");
    revalidatePath("/bugun");
    return { ok: true, message: `${segment.code} planı güncellendi.` };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

/** Bir pier'e toplu segment ekler (§52). Var olan segment numaraları atlanır. */
export async function createSegments(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "segment", "create");

    const createSchema = z.object({
      pierElementId: z.string().min(1, "Pier seçilmelidir."),
      side: z.enum(["SOL", "SAG", "TEK"]),
      fromNumber: z.coerce.number().int().min(0),
      toNumber: z.coerce.number().int().min(0).max(60),
    });
    const parsed = createSchema.safeParse({
      pierElementId: formData.get("pierElementId"),
      side: formData.get("side") || "SOL",
      fromNumber: formData.get("fromNumber") ?? 0,
      toNumber: formData.get("toNumber"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
    }
    const d = parsed.data;
    if (d.toNumber < d.fromNumber) {
      return { ok: false, message: "Bitiş segment numarası başlangıçtan küçük olamaz." };
    }

    const pier = await prisma.structureElement.findUnique({
      where: { id: d.pierElementId },
      include: { structure: true, parent: true },
    });
    if (!pier) return { ok: false, message: "Pier bulunamadı." };

    // Segment kodu pier kodundan üretilir (gövde elemanıysa üst pier kodu kullanılır)
    const baseCode = pier.parent?.code ?? pier.code;

    let created = 0;
    let skipped = 0;
    await prisma.$transaction(async (tx) => {
      for (let n = d.fromNumber; n <= d.toNumber; n++) {
        const code = buildSegmentCode(baseCode, d.side, n);
        const exists = await tx.balancedCantileverSegment.findUnique({ where: { code } });
        if (exists) {
          skipped++;
          continue;
        }
        await tx.balancedCantileverSegment.create({
          data: {
            pierElementId: d.pierElementId,
            code,
            segmentNumber: n,
            side: d.side,
            status: "PLANLANMADI",
          },
        });
        created++;
      }
      if (created > 0) {
        await tx.structure.update({
          where: { id: pier.structureId },
          data: { hasBalancedCantilever: true },
        });
        await tx.auditLog.create({
          data: {
            entityType: "BalancedCantileverSegment",
            entityId: d.pierElementId,
            fieldName: "createSegments",
            oldValue: null,
            newValue: `${created} segment oluşturuldu (${d.side} ${d.fromNumber}-${d.toNumber})`,
            changedById: session.user.id,
          },
        });
      }
    });

    revalidatePath("/segmentler");
    revalidatePath(`/yapilar/${encodeURIComponent(pier.structure.code)}`);
    const skipMsg = skipped > 0 ? ` ${skipped} segment zaten kayıtlıydı, atlandı.` : "";
    return { ok: true, message: `${created} segment oluşturuldu.${skipMsg}` };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}
