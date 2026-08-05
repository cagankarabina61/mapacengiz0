"use server";
// Beton dökümü server action'ları: hazırlık kapısı + override + audit (tasarım §5).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertPermission, hasPermission, YetkiHatasi } from "@/lib/permissions";
import { logChanges } from "@/lib/audit";
import {
  createChecklistForPour,
  nextPourCode,
  getPourReadiness,
  computePourDuration,
} from "@/lib/services/pours";
import { pourWindow } from "@/lib/logic/pour-planning";
import type { ActionResult } from "@/app/actions/piles";

const createSchema = z.object({
  target: z.string().regex(/^(PILE|ELEM|SEG):.+$/, "Hedef eleman seçilmelidir."),
  plannedDate: z.string().min(1, "Tarih zorunludur."),
  plannedTime: z.string().optional(),
  concreteClass: z.string().optional(),
  plannedVolumeM3: z.coerce.number().positive("Beton hacmi pozitif olmalıdır."),
  pumpResourceId: z.string().optional(),
  crewResourceId: z.string().optional(),
  responsibleUserId: z.string().optional(),
  // Madde 10: süre elle girilebilir; girilmezse pompa kapasitesinden hesaplanır
  durationMin: z.coerce.number().positive().optional(),
});

/** Yeni beton dökümü (madde 61 minimal akışı). Başarıda detay sayfasına yönlenir. */
export async function createPour(formData: FormData): Promise<ActionResult> {
  let code: string;
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "concretePour", "create");

    const parsed = createSchema.safeParse({
      target: formData.get("target"),
      plannedDate: formData.get("plannedDate"),
      plannedTime: formData.get("plannedTime") || undefined,
      concreteClass: formData.get("concreteClass") || undefined,
      plannedVolumeM3: formData.get("plannedVolumeM3"),
      pumpResourceId: formData.get("pumpResourceId") || undefined,
      crewResourceId: formData.get("crewResourceId") || undefined,
      responsibleUserId: formData.get("responsibleUserId") || undefined,
      durationMin: formData.get("durationMin") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
    }
    const d = parsed.data;
    const [kind, targetId] = d.target.split(":");
    const targetType = kind === "PILE" ? "PILE" : kind === "SEG" ? "SEGMENT" : "STRUCTURE_ELEMENT";

    // Hedefin gerçekten var olduğunu doğrula (madde 55: olmayan elemana kayıt eklenemez)
    if (targetType === "PILE" && !(await prisma.pile.findUnique({ where: { id: targetId } })))
      return { ok: false, message: "Seçilen kazık bulunamadı." };
    if (
      targetType === "STRUCTURE_ELEMENT" &&
      !(await prisma.structureElement.findUnique({ where: { id: targetId } }))
    )
      return { ok: false, message: "Seçilen eleman bulunamadı." };
    if (
      targetType === "SEGMENT" &&
      !(await prisma.balancedCantileverSegment.findUnique({ where: { id: targetId } }))
    )
      return { ok: false, message: "Seçilen segment bulunamadı." };

    // Süre: elle girilmediyse pompa kapasitesinden hesaplanır; kapasite yoksa null kalır (madde 10)
    const duration = await computePourDuration(
      d.pumpResourceId ?? null,
      d.plannedVolumeM3,
      d.durationMin ?? null
    );
    const plannedDate = new Date(d.plannedDate);
    const window = pourWindow(plannedDate, d.plannedTime ?? null, duration.durationMin);

    code = await nextPourCode();
    await prisma.$transaction(async (tx) => {
      const pour = await tx.concretePour.create({
        data: {
          code,
          targetType,
          pileId: targetType === "PILE" ? targetId : undefined,
          structureElementId: targetType === "STRUCTURE_ELEMENT" ? targetId : undefined,
          segmentId: targetType === "SEGMENT" ? targetId : undefined,
          plannedDate,
          plannedTime: d.plannedTime,
          concreteClass: d.concreteClass,
          plannedVolumeM3: d.plannedVolumeM3,
          pumpResourceId: d.pumpResourceId,
          crewResourceId: d.crewResourceId,
          responsibleUserId: d.responsibleUserId,
          estimatedDurationMin: duration.durationMin,
          durationOverridden: duration.isOverride,
          plannedEndTime: window.end,
          status: "PLANLANDI",
        },
      });
      await createChecklistForPour(tx, pour.id, targetType);
      // Kaynak rezervasyonları — çakışma tespitinin veri kaynağı (madde 4)
      for (const resourceId of [d.pumpResourceId, d.crewResourceId]) {
        if (!resourceId) continue;
        await tx.resourceBooking.create({
          data: {
            resourceId,
            targetType: "CONCRETE_POUR",
            pourId: pour.id,
            startDateTime: window.start,
            endDateTime: window.end,
          },
        });
      }
    });
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
  redirect(`/beton/${code}`);
}

/** Checklist maddesi işaretleme — bazı maddeler rol kısıtlı (madde 40). */
const ROLE_RESTRICTED_ITEMS: Record<string, { resource: string; label: string }> = {
  QAQC_DONE: { resource: "pourQaqc", label: "QA/QC" },
  ITP_RELEASED: { resource: "pourQaqc", label: "QA/QC" },
  SURVEY_DONE: { resource: "pourSurvey", label: "Survey" },
};

export async function toggleChecklistItem(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const itemId = String(formData.get("itemId") ?? "");
    const item = await prisma.concretePourChecklistItem.findUnique({
      where: { id: itemId },
      include: { pour: true },
    });
    if (!item) return { ok: false, message: "Kontrol maddesi bulunamadı." };

    const restriction = ROLE_RESTRICTED_ITEMS[item.itemKey];
    if (restriction) {
      const allowed = await hasPermission(session.user.role, restriction.resource, "update");
      if (!allowed) {
        return {
          ok: false,
          message: `Bu madde yalnızca ${restriction.label} tarafından işaretlenebilir.`,
        };
      }
    } else {
      await assertPermission(session.user.role, "checklist", "update");
    }

    const newValue = !item.isChecked;
    await prisma.$transaction(async (tx) => {
      await tx.concretePourChecklistItem.update({
        where: { id: itemId },
        data: {
          isChecked: newValue,
          checkedById: newValue ? session.user.id : null,
          checkedAt: newValue ? new Date() : null,
        },
      });
      // QA/QC ve Survey maddeleri pour üstündeki özet durumları da günceller
      if (item.itemKey === "QAQC_DONE") {
        await tx.concretePour.update({
          where: { id: item.pourId },
          data: { qaqcStatus: newValue ? "TAMAMLANDI" : "BEKLIYOR" },
        });
      }
      if (item.itemKey === "SURVEY_DONE") {
        await tx.concretePour.update({
          where: { id: item.pourId },
          data: { surveyStatus: newValue ? "TAMAMLANDI" : "BEKLIYOR" },
        });
      }
      if (item.itemKey === "ITP_RELEASED") {
        await tx.concretePour.update({
          where: { id: item.pourId },
          data: { itpStatus: newValue ? "TAMAMLANDI" : "BEKLIYOR" },
        });
      }
      await logChanges(tx, {
        entityType: "ConcretePourChecklistItem",
        entityId: itemId,
        before: { isChecked: item.isChecked },
        after: { isChecked: newValue },
        changedById: session.user.id,
      });
    });

    revalidatePath(`/beton/${item.pour.code}`);
    revalidatePath("/beton");
    return { ok: true, message: "Kontrol listesi güncellendi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

/** Manuel override (madde 11): sadece yetkili, gerekçe zorunlu, audit'e yazılır. */
export async function overridePour(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "pourOverride", "create");

    const pourId = String(formData.get("pourId") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    if (!reason) return { ok: false, message: "Override için gerekçe zorunludur." };

    const pour = await prisma.concretePour.findUnique({ where: { id: pourId } });
    if (!pour) return { ok: false, message: "Beton dökümü bulunamadı." };

    await prisma.$transaction(async (tx) => {
      await tx.concretePour.update({
        where: { id: pourId },
        data: {
          isOverride: true,
          overrideById: session.user.id,
          overrideAt: new Date(),
          overrideReason: reason,
        },
      });
      await logChanges(tx, {
        entityType: "ConcretePour",
        entityId: pourId,
        before: { isOverride: pour.isOverride },
        after: { isOverride: true },
        changedById: session.user.id,
        reason,
      });
    });

    revalidatePath(`/beton/${pour.code}`);
    return { ok: true, message: "Override uygulandı. Bu işlem kayıt altına alındı." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

/**
 * Kritik kaynak çakışmasını yetkili kullanıcı kabul eder (madde 4).
 * Gerekçe zorunludur; kim/ne zaman/neden AuditLog'a yazılır.
 */
export async function overrideResourceConflict(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "resourceBooking", "update");

    const pourId = String(formData.get("pourId") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    if (!reason) {
      return { ok: false, message: "Kaynak çakışmasını kabul etmek için gerekçe zorunludur." };
    }

    const pour = await prisma.concretePour.findUnique({
      where: { id: pourId },
      include: { bookings: true },
    });
    if (!pour) return { ok: false, message: "Beton dökümü bulunamadı." };
    if (pour.bookings.length === 0) {
      return { ok: false, message: "Bu döküm için kaynak rezervasyonu bulunmuyor." };
    }

    await prisma.$transaction(async (tx) => {
      for (const booking of pour.bookings) {
        await tx.resourceBooking.update({
          where: { id: booking.id },
          data: {
            conflictOverride: true,
            conflictOverrideReason: reason,
            conflictOverrideById: session.user.id,
            conflictOverrideAt: new Date(),
          },
        });
        await logChanges(tx, {
          entityType: "ResourceBooking",
          entityId: booking.id,
          before: { conflictOverride: booking.conflictOverride },
          after: { conflictOverride: true },
          changedById: session.user.id,
          reason,
        });
      }
    });

    revalidatePath(`/beton/${pour.code}`);
    revalidatePath("/");
    return {
      ok: true,
      message: "Kaynak çakışması kabul edildi. Bu işlem kayıt altına alındı.",
    };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

/** Durum geçişleri: Dökülüyor / Tamamlandı — hazırlık kapısı korunur (TEST 1). */
export async function transitionPour(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "concretePour", "update");

    const pourId = String(formData.get("pourId") ?? "");
    const to = String(formData.get("to") ?? "");
    const pour = await prisma.concretePour.findUnique({ where: { id: pourId } });
    if (!pour) return { ok: false, message: "Beton dökümü bulunamadı." };

    if (to === "BETON_DOKULUYOR") {
      const readiness = await getPourReadiness(pourId);
      if (!readiness.isReady) {
        return {
          ok: false,
          message: `Beton dökümüne başlanamaz. Eksik: ${readiness.missingItems
            .slice(0, 4)
            .map((i) => i.label)
            .join(", ")}${readiness.missingItems.length > 4 ? "…" : ""}`,
        };
      }
      await prisma.$transaction(async (tx) => {
        await tx.concretePour.update({
          where: { id: pourId },
          data: { status: "BETON_DOKULUYOR", pourStart: new Date() },
        });
        await logChanges(tx, {
          entityType: "ConcretePour",
          entityId: pourId,
          before: { status: pour.status },
          after: { status: "BETON_DOKULUYOR" },
          changedById: session.user.id,
        });
      });
    } else if (to === "TAMAMLANDI") {
      if (pour.status !== "BETON_DOKULUYOR") {
        return { ok: false, message: "Önce beton dökümü başlatılmalıdır." };
      }
      const actualVolume = formData.get("actualVolumeM3");
      const vol = actualVolume ? Number(actualVolume) : null;
      if (vol !== null && (Number.isNaN(vol) || vol <= 0)) {
        return { ok: false, message: "Gerçekleşen hacim pozitif bir sayı olmalıdır." };
      }
      await prisma.$transaction(async (tx) => {
        await tx.concretePour.update({
          where: { id: pourId },
          data: {
            status: "TAMAMLANDI",
            pourEnd: new Date(),
            ...(vol !== null ? { actualVolumeM3: vol } : {}),
          },
        });
        await logChanges(tx, {
          entityType: "ConcretePour",
          entityId: pourId,
          before: { status: pour.status, actualVolumeM3: pour.actualVolumeM3 },
          after: { status: "TAMAMLANDI", actualVolumeM3: vol ?? pour.actualVolumeM3 },
          changedById: session.user.id,
        });
      });
    } else {
      return { ok: false, message: "Geçersiz durum geçişi." };
    }

    revalidatePath(`/beton/${pour.code}`);
    revalidatePath("/beton");
    return { ok: true, message: "Durum güncellendi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}
