// Audit log yardımcı (tasarım §11, madde 38/56): alan bazlı eski/yeni değer kaydı.
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

function serialize(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

/**
 * Bir entity güncellemesi öncesi/sonrası farkları AuditLog'a yazar.
 * tx içinde çağrılırsa atomiktir.
 */
export async function logChanges(
  db: Prisma.TransactionClient | typeof prisma,
  params: {
    entityType: string;
    entityId: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    changedById: string;
    reason?: string;
  }
): Promise<void> {
  const entries: Prisma.AuditLogCreateManyInput[] = [];
  for (const key of Object.keys(params.after)) {
    const oldValue = serialize(params.before[key]);
    const newValue = serialize(params.after[key]);
    if (oldValue !== newValue) {
      entries.push({
        entityType: params.entityType,
        entityId: params.entityId,
        fieldName: key,
        oldValue,
        newValue,
        changedById: params.changedById,
        reason: params.reason ?? null,
      });
    }
  }
  if (entries.length > 0) {
    await db.auditLog.createMany({ data: entries });
  }
}
