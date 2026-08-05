"use server";
// RFI server action'ları (madde 22-23): oluşturma + durum akışı + etkilenen işler.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertPermission, YetkiHatasi } from "@/lib/permissions";
import { logChanges } from "@/lib/audit";
import { Priority, RFIStatus } from "@prisma/client";
import type { ActionResult } from "@/app/actions/piles";

async function nextRfiNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RFI-${year}-`;
  const last = await prisma.rFI.findFirst({
    where: { rfiNumber: { startsWith: prefix } },
    orderBy: { rfiNumber: "desc" },
    select: { rfiNumber: true },
  });
  const n = last ? parseInt(last.rfiNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(n).padStart(3, "0")}`;
}

export async function createRFI(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "rfi", "create");

    const schema = z.object({
      structureId: z.string().min(1, "Yapı seçilmelidir."),
      elementId: z.string().optional(),
      subject: z.string().min(3, "Konu en az 3 karakter olmalıdır."),
      description: z.string().optional(),
      priority: z.nativeEnum(Priority),
    });
    const parsed = schema.safeParse({
      structureId: formData.get("structureId"),
      elementId: formData.get("elementId") || undefined,
      subject: formData.get("subject"),
      description: formData.get("description") || undefined,
      priority: formData.get("priority") ?? "ORTA",
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
    }
    const d = parsed.data;
    const affectedActivityIds = formData.getAll("affectedActivityIds").map(String).filter(Boolean);

    if (!(await prisma.structure.findUnique({ where: { id: d.structureId } })))
      return { ok: false, message: "Seçilen yapı bulunamadı." };

    const rfiNumber = await nextRfiNumber();
    await prisma.$transaction(async (tx) => {
      const rfi = await tx.rFI.create({
        data: {
          rfiNumber,
          date: new Date(),
          structureId: d.structureId,
          elementId: d.elementId,
          subject: d.subject,
          description: d.description,
          priority: d.priority,
          status: "TASLAK",
        },
      });
      for (const activityId of affectedActivityIds) {
        const exists = await tx.activity.findUnique({ where: { id: activityId } });
        if (exists) {
          await tx.rFIAffectedActivity.create({ data: { rfiId: rfi.id, activityId } });
        }
      }
    });

    revalidatePath("/rfi");
    revalidatePath("/bloke");
    return { ok: true, message: `${rfiNumber} oluşturuldu.` };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

// Durum akışı: Taslak → Gönderildi → Cevap Bekleniyor → Cevaplandı → Kapatıldı
const ALLOWED_TRANSITIONS: Record<RFIStatus, RFIStatus[]> = {
  TASLAK: ["GONDERILDI"],
  GONDERILDI: ["CEVAP_BEKLENIYOR", "CEVAPLANDI"],
  CEVAP_BEKLENIYOR: ["CEVAPLANDI"],
  CEVAPLANDI: ["KAPATILDI"],
  KAPATILDI: [],
};

export async function transitionRFI(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "rfi", "update");

    const schema = z.object({
      rfiId: z.string().min(1),
      status: z.nativeEnum(RFIStatus),
    });
    const parsed = schema.safeParse({
      rfiId: formData.get("rfiId"),
      status: formData.get("status"),
    });
    if (!parsed.success) return { ok: false, message: "Geçersiz veri gönderildi." };
    const { rfiId, status } = parsed.data;

    const rfi = await prisma.rFI.findUnique({ where: { id: rfiId } });
    if (!rfi) return { ok: false, message: "RFI bulunamadı." };
    if (!ALLOWED_TRANSITIONS[rfi.status].includes(status)) {
      return {
        ok: false,
        message: `"${rfi.status}" durumundan "${status}" durumuna geçiş yapılamaz.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.rFI.update({
        where: { id: rfiId },
        data: {
          status,
          ...(status === "GONDERILDI" ? { submittedDate: new Date() } : {}),
          ...(status === "CEVAPLANDI" ? { answeredDate: new Date() } : {}),
        },
      });
      await logChanges(tx, {
        entityType: "RFI",
        entityId: rfiId,
        before: { status: rfi.status },
        after: { status },
        changedById: session.user.id,
      });
    });

    revalidatePath("/rfi");
    revalidatePath("/bloke");
    return { ok: true, message: "RFI durumu güncellendi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}
