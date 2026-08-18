// Not yazma yardımcısı — logChanges (src/lib/audit.ts) ile aynı imza stili:
// tx client veya kök client kabul eder, böylece ikisi tek $transaction içinde
// birlikte çalışabilir.
import type { Prisma } from "@prisma/client";
import type { prisma } from "@/lib/db";

export interface WriteNoteParams {
  entityType: string;
  entityId: string;
  body: string;
  authorId: string;
  /** Sistemin ürettiği belirli bir satıra çapa (risk key / blokaj kodu). */
  anchorKey?: string | null;
  /** Bir kayıt düzenlemesinin gerekçesi olarak bırakıldıysa true. */
  isEditReason?: boolean;
}

/**
 * Notu yazar. Boş/yalnızca boşluk içeren gövde sessizce atlanır (null döner) —
 * böylece "not alanı boş bırakıldı" durumu çağıranda ayrıca kontrol edilmez.
 */
export async function writeNoteInTx(
  db: Prisma.TransactionClient | typeof prisma,
  params: WriteNoteParams
) {
  const body = params.body.trim();
  if (!body) return null;
  return db.note.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      body,
      authorId: params.authorId,
      anchorKey: params.anchorKey ?? null,
      isEditReason: params.isEditReason ?? false,
    },
  });
}
