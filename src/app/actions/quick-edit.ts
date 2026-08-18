"use server";
// Liste satırından hızlı düzenleme — sahanın telefondan tek dokunuşla
// durum/zaman damgası girmesi ve not bırakması için.
//
// ÇİFT YAZIM: tek not alanı iki hedefe yazılır —
//   • AuditLog.reason  → değişmez, alan bazlı makine kaydı (logChanges)
//   • Note             → yazarlı, tarihli, düzenlenebilir insan katmanı
// AuditLog not deposu olarak kullanılmaz: yazma amaçlıdır, reason'ı değişen
// her alan için tekrarlar; üç alanlık düzenleme üç kopya not gösterirdi.
//
// Entity başına ayrı action: alan adları uyuşmuyor (Activity.actualStart vs
// ConcretePour.pourStart), status enum'ları ve izin kaynakları farklı.
// Tekrar, ikisini de aynı FormData alan adlarıyla süren TEK istemci sheet'inde
// kalkar — veri katmanında jenerik dispatch yapılmaz.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertPermission, YetkiHatasi } from "@/lib/permissions";
import { logChanges } from "@/lib/audit";
import { writeNoteInTx } from "@/lib/notes";
import { safeRevalidate } from "@/lib/revalidate";
import { ActivityStatus, ConcretePourStatus } from "@prisma/client";
import type { ActionResult } from "@/app/actions/piles";

const NOTE_MAX = 2000;

const baseShape = {
  id: z.string().min(1),
  note: z.string().trim().max(NOTE_MAX).optional(),
  crewResourceId: z.string().optional(),
  stampStart: z.enum(["1"]).optional(),
  stampEnd: z.enum(["1"]).optional(),
  from: z.string().optional(),
};

const NOTHING_TO_DO = "Değişiklik yapılmadı ve not girilmedi.";

/** Ekip alanı: boş string → null (atamayı kaldır), tanımsız → dokunma. */
function crewPatch(
  incoming: string | undefined,
  current: string | null
): { crewResourceId: string | null } | null {
  if (incoming === undefined) return null;
  const next = incoming || null;
  return next === current ? null : { crewResourceId: next };
}

// ─────────────────────────────────────────────
// Aktivite (iş kalemi)
// ─────────────────────────────────────────────

const activitySchema = z.object({
  ...baseShape,
  status: z.nativeEnum(ActivityStatus).optional(),
});

export async function quickEditActivity(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "activity", "update");

    const parsed = activitySchema.safeParse({
      id: formData.get("id"),
      note: formData.get("note") || undefined,
      crewResourceId: formData.get("crewResourceId") ?? undefined,
      stampStart: formData.get("stampStart") || undefined,
      stampEnd: formData.get("stampEnd") || undefined,
      status: formData.get("status") || undefined,
      from: formData.get("from") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
    }
    const d = parsed.data;

    const current = await prisma.activity.findUnique({ where: { id: d.id } });
    if (!current) return { ok: false, message: "İş kaydı bulunamadı." };

    const now = new Date();
    const data: Record<string, unknown> = {};
    if (d.status && d.status !== current.status) data.status = d.status;
    const crew = crewPatch(d.crewResourceId, current.crewResourceId);
    if (crew) Object.assign(data, crew);
    // Zaman damgası yalnızca BOŞ alanı doldurur — kazara üzerine yazma yok.
    if (d.stampStart === "1" && !current.actualStart) data.actualStart = now;
    if (d.stampEnd === "1" && !current.actualEnd) data.actualEnd = now;

    const changed = Object.keys(data).length > 0;
    if (!changed && !d.note) return { ok: false, message: NOTHING_TO_DO };

    await prisma.$transaction(async (tx) => {
      if (changed) {
        await tx.activity.update({ where: { id: d.id }, data });
        await logChanges(tx, {
          entityType: "Activity",
          entityId: d.id,
          before: current as unknown as Record<string, unknown>,
          after: data,
          changedById: session.user.id,
          reason: d.note || undefined,
        });
      }
      if (d.note) {
        await writeNoteInTx(tx, {
          entityType: "Activity",
          entityId: d.id,
          body: d.note,
          authorId: session.user.id,
          isEditReason: changed,
        });
      }
    });

    safeRevalidate(d.from);
    revalidatePath("/bugun");
    revalidatePath("/");
    revalidatePath("/bloke");
    return { ok: true, message: changed && d.note ? "Kaydedildi, not eklendi." : changed ? "Kaydedildi." : "Not eklendi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

// ─────────────────────────────────────────────
// Beton dökümü
// ─────────────────────────────────────────────

const pourSchema = z.object({
  ...baseShape,
  status: z.nativeEnum(ConcretePourStatus).optional(),
});

export async function quickEditPour(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "concretePour", "update");

    const parsed = pourSchema.safeParse({
      id: formData.get("id"),
      note: formData.get("note") || undefined,
      crewResourceId: formData.get("crewResourceId") ?? undefined,
      stampStart: formData.get("stampStart") || undefined,
      stampEnd: formData.get("stampEnd") || undefined,
      status: formData.get("status") || undefined,
      from: formData.get("from") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
    }
    const d = parsed.data;

    const current = await prisma.concretePour.findUnique({ where: { id: d.id } });
    if (!current) return { ok: false, message: "Beton dökümü bulunamadı." };

    const now = new Date();
    const data: Record<string, unknown> = {};
    if (d.status && d.status !== current.status) data.status = d.status;
    const crew = crewPatch(d.crewResourceId, current.crewResourceId);
    if (crew) Object.assign(data, crew);
    if (d.stampStart === "1" && !current.pourStart) data.pourStart = now;
    if (d.stampEnd === "1" && !current.pourEnd) data.pourEnd = now;

    const changed = Object.keys(data).length > 0;
    if (!changed && !d.note) return { ok: false, message: NOTHING_TO_DO };

    await prisma.$transaction(async (tx) => {
      if (changed) {
        await tx.concretePour.update({ where: { id: d.id }, data });
        await logChanges(tx, {
          entityType: "ConcretePour",
          entityId: d.id,
          before: current as unknown as Record<string, unknown>,
          after: data,
          changedById: session.user.id,
          reason: d.note || undefined,
        });
      }
      if (d.note) {
        await writeNoteInTx(tx, {
          entityType: "ConcretePour",
          entityId: d.id,
          body: d.note,
          authorId: session.user.id,
          isEditReason: changed,
        });
      }
    });

    safeRevalidate(d.from);
    revalidatePath("/bugun");
    revalidatePath("/");
    revalidatePath("/beton");
    revalidatePath(`/beton/${current.code}`);
    return { ok: true, message: changed && d.note ? "Kaydedildi, not eklendi." : changed ? "Kaydedildi." : "Not eklendi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}
