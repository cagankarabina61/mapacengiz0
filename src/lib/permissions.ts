// Merkezi yetki denetimi (tasarım §4, madde 40).
// YONETICI → her şey; IZLEYICI → sadece okuma; diğer roller → RolePermission tablosu.
import { prisma } from "@/lib/db";
import type { RoleName } from "@prisma/client";

export class YetkiHatasi extends Error {
  constructor(message = "Bu işlem için yetkiniz yok.") {
    super(message);
    this.name = "YetkiHatasi";
  }
}

// Kaynak/eylem katalogu. prisma/seed.ts'teki perms dizisiyle birebir aynı olmalıdır.
// Serbest string kullanılsaydı "notes" ↔ "note" gibi bir yazım hatası hiçbir uyarı
// vermeden sessizce reddederdi; union tipi bunu derleme zamanında yakalar.
export type PermAction = "create" | "read" | "update" | "delete";

export type PermResource =
  | "structure"
  | "element"
  | "activity"
  | "segment"
  | "pile"
  | "pileTest"
  | "concretePour"
  | "pourOverride"
  | "pourQaqc"
  | "pourSurvey"
  | "checklist"
  | "resourceBooking"
  | "drawing"
  | "rfi"
  | "ncr"
  | "inspection"
  | "itpTemplate"
  | "surveyRecord"
  | "issue"
  | "attachment"
  | "note"
  | "attentionItem";

// İzinler nadiren değişir; süreçte kısa süreli cache yeterli.
let permCache: { key: string; loadedAt: number; perms: Set<string> } | null = null;
const CACHE_TTL_MS = 60_000;

async function loadPermissions(): Promise<Set<string>> {
  const now = Date.now();
  if (permCache && now - permCache.loadedAt < CACHE_TTL_MS) return permCache.perms;
  const rows = await prisma.rolePermission.findMany();
  const perms = new Set(rows.map((r) => `${r.role}:${r.resource}:${r.action}`));
  permCache = { key: "all", loadedAt: now, perms };
  return perms;
}

export async function hasPermission(
  role: RoleName,
  resource: PermResource,
  action: PermAction
): Promise<boolean> {
  if (role === "YONETICI") return true;
  if (action === "read") return true; // tüm roller okuyabilir (İzleyici dahil)
  if (role === "IZLEYICI") return false;
  const perms = await loadPermissions();
  return perms.has(`${role}:${resource}:${action}`);
}

export async function assertPermission(
  role: RoleName,
  resource: PermResource,
  action: PermAction
): Promise<void> {
  if (!(await hasPermission(role, resource, action))) {
    throw new YetkiHatasi();
  }
}

/**
 * İzin önbelleğini elle boşaltır. Seed/yönetim ekranı izinleri değiştirdiğinde
 * 60 sn beklemeden etkili olması için. Önbellek süreç başınadır.
 */
export function invalidatePermissionCache(): void {
  permCache = null;
}
