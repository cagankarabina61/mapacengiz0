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
  resource: string,
  action: string
): Promise<boolean> {
  if (role === "YONETICI") return true;
  if (action === "read") return true; // tüm roller okuyabilir (İzleyici dahil)
  if (role === "IZLEYICI") return false;
  const perms = await loadPermissions();
  return perms.has(`${role}:${resource}:${action}`);
}

export async function assertPermission(
  role: RoleName,
  resource: string,
  action: string
): Promise<void> {
  if (!(await hasPermission(role, resource, action))) {
    throw new YetkiHatasi();
  }
}
