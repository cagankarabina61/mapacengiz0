// Kimlik katmanı — ŞİFRE YOK (2026-08-18 kullanıcı kararı).
//
// Şantiye ofisinde 7 kişi çalışıyor ve şifreli giriş istenmedi. Bunun yerine
// kullanıcı ilk açılışta "Kim kullanıyor?" ekranından adını seçer; seçim bir
// çerezde saklanır. Bu bir GÜVENLİK KATMANI DEĞİLDİR — kimliği doğrulamaz,
// yalnızca beyan eder. Amacı, notların ve değişiklik kayıtlarının kime ait
// olduğunun kaybolmaması (Note.authorId, AuditLog.changedById).
//
// UYARI: Site herkese açık bir adreste yayında. Şifre olmadığı için adresi
// bilen herkes veri girebilir/silebilir. Bu bilinçli bir tercihtir.
//
// next-auth kaldırıldı; AUTH_SECRET / AUTH_TRUST_HOST artık gerekmiyor.
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { RoleName } from "@prisma/client";

export const KULLANICI_COOKIE = "sy_kullanici";
/** Bir yıl — pratikte kalıcı; kullanıcı isterse /giris'ten değiştirir. */
const COOKIE_OMRU = 60 * 60 * 24 * 365;

export interface Oturum {
  user: {
    id: string;
    name: string;
    email: string;
    role: RoleName;
  };
}

/**
 * Çerezde seçili kullanıcıyı döner. Seçim yoksa veya kullanıcı silinmişse null.
 * next-auth'un auth() fonksiyonuyla aynı şekli döner; çağrı yerleri değişmedi.
 */
export async function auth(): Promise<Oturum | null> {
  const id = (await cookies()).get(KULLANICI_COOKIE)?.value;
  if (!id) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

/** Kullanıcı seçilmemişse seçim ekranına yönlendirir. */
export async function requireSession(): Promise<Oturum> {
  const session = await auth();
  if (!session) {
    const { redirect } = await import("next/navigation");
    redirect("/giris");
  }
  return session!;
}

/** Seçim ekranında listelenecek kullanıcılar. */
export async function listUsers() {
  return prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function setCurrentUser(userId: string): Promise<void> {
  (await cookies()).set(KULLANICI_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_OMRU,
  });
}

export async function clearCurrentUser(): Promise<void> {
  (await cookies()).delete(KULLANICI_COOKIE);
}
