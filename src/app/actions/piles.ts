"use server";
// Kazık server action'ları: yetki + iş kuralı + audit log (madde 40/55/56).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertPermission, YetkiHatasi } from "@/lib/permissions";
import { logChanges } from "@/lib/audit";
import { PileStatus } from "@prisma/client";

const updateSchema = z.object({
  pileId: z.string().min(1),
  status: z.nativeEnum(PileStatus),
  reason: z.string().optional(),
});

export interface ActionResult {
  ok: boolean;
  message: string;
}

// Kabul edilebilmesi için kazığın en az test aşamasını geçmiş olması gerekir (TEST 2).
const ACCEPT_PREREQUISITES: PileStatus[] = ["TEST_YAPILDI", "KABUL_EDILDI"];

export async function updatePileStatus(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "pile", "update");

    const parsed = updateSchema.safeParse({
      pileId: formData.get("pileId"),
      status: formData.get("status"),
      reason: formData.get("reason") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, message: "Geçersiz veri gönderildi." };
    }
    const { pileId, status, reason } = parsed.data;

    const pile = await prisma.pile.findUnique({ where: { id: pileId } });
    if (!pile) return { ok: false, message: "Kazık bulunamadı." };

    // İş kuralı (madde 55): tamamlanmamış kazık kabul edilemez.
    if (status === "KABUL_EDILDI" && !ACCEPT_PREREQUISITES.includes(pile.status)) {
      return {
        ok: false,
        message: "Testi yapılmamış kazık kabul edilemez. Önce test sonucu girilmelidir.",
      };
    }

    const updates: Record<string, unknown> = { status };
    if (status === "KABUL_EDILDI") updates.acceptanceStatus = "KABUL";
    if (status === "TEST_YAPILDI") updates.testStatus = "YAPILDI";

    await prisma.$transaction(async (tx) => {
      await tx.pile.update({ where: { id: pileId }, data: updates });
      await logChanges(tx, {
        entityType: "Pile",
        entityId: pileId,
        before: { status: pile.status },
        after: { status },
        changedById: session.user.id,
        reason,
      });
    });

    revalidatePath("/kazik");
    return { ok: true, message: "Kazık durumu güncellendi." };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}

/** Toplu durum güncelleme (madde 36). */
export async function bulkUpdatePileStatus(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "pile", "update");

    const ids = formData.getAll("pileIds").map(String).filter(Boolean);
    const statusRaw = formData.get("status");
    const parsed = z.nativeEnum(PileStatus).safeParse(statusRaw);
    if (ids.length === 0 || !parsed.success) {
      return { ok: false, message: "Kazık seçilmedi veya durum geçersiz." };
    }
    const status = parsed.data;

    const piles = await prisma.pile.findMany({ where: { id: { in: ids } } });
    if (status === "KABUL_EDILDI") {
      const notReady = piles.filter((p) => !ACCEPT_PREREQUISITES.includes(p.status));
      if (notReady.length > 0) {
        return {
          ok: false,
          message: `${notReady.length} kazığın testi yapılmadığı için kabul edilemedi: ${notReady
            .slice(0, 5)
            .map((p) => p.code)
            .join(", ")}${notReady.length > 5 ? "…" : ""}`,
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const pile of piles) {
        await tx.pile.update({
          where: { id: pile.id },
          data: {
            status,
            ...(status === "KABUL_EDILDI" ? { acceptanceStatus: "KABUL" as const } : {}),
            ...(status === "TEST_YAPILDI" ? { testStatus: "YAPILDI" as const } : {}),
          },
        });
        await logChanges(tx, {
          entityType: "Pile",
          entityId: pile.id,
          before: { status: pile.status },
          after: { status },
          changedById: session.user.id,
        });
      }
    });

    revalidatePath("/kazik");
    return { ok: true, message: `${piles.length} kazık güncellendi.` };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Beklenmeyen bir hata oluştu." };
  }
}
