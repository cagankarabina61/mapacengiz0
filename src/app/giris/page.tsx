// "Kim kullanıyor?" ekranı — ŞİFRE YOK.
// Kimlik doğrulamaz, yalnızca kaydı kimin girdiğini işaretler. Seçim bir yıl
// geçerli çerezde saklanır; değiştirmek için buraya dönmek yeterli.
import { redirect } from "next/navigation";
import { listUsers, setCurrentUser, auth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/labels";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function KullaniciSecPage({
  searchParams,
}: {
  searchParams: Promise<{ degistir?: string }>;
}) {
  const { degistir } = await searchParams;
  const session = await auth();
  // Zaten seçiliyse ve "değiştir" denmediyse doğrudan içeri al.
  if (session && !degistir) redirect("/");

  const users = await listUsers();

  async function sec(formData: FormData) {
    "use server";
    const id = String(formData.get("userId") ?? "");
    if (!id) return;
    await setCurrentUser(id);
    redirect("/");
  }

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface rounded-2xl p-6 ring-1 ring-slate-900/5 shadow-[var(--shadow-raised)]">
        <div className="w-10 h-10 rounded-xl bg-nav flex items-center justify-center mb-4">
          <span className="text-white font-bold text-sm">SY</span>
        </div>
        <h1 className="text-lg font-bold text-slate-900 mb-1 tracking-tight">
          Sanat Yapıları Yönetim Sistemi
        </h1>
        <p className="text-sm text-muted mb-6">
          Kim kullanıyor? Girdiğiniz kayıtlar bu isimle işaretlenir.
        </p>

        {users.length === 0 ? (
          <p className="text-sm text-red-700 bg-red-50 ring-1 ring-inset ring-red-100 rounded-lg px-3 py-2">
            Sistemde kayıtlı kullanıcı yok. Sunucuda <code>npm run db:seed</code> çalıştırılmalı.
          </p>
        ) : (
          <ul className="space-y-2">
            {users.map((u) => (
              <li key={u.id}>
                <form action={sec}>
                  <input type="hidden" name="userId" value={u.id} />
                  <button
                    type="submit"
                    className="w-full min-h-14 px-4 rounded-lg text-left ring-1 ring-inset ring-slate-300 bg-surface hover:bg-slate-50 hover:ring-accent transition-colors duration-150 flex items-center justify-between gap-3"
                  >
                    <span className="font-medium text-slate-900">{u.name}</span>
                    <Badge tone="gray">{ROLE_LABELS[u.role]}</Badge>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted mt-6">
          Şifre istenmiyor. Bu ekran kimlik doğrulamaz, yalnızca kayıtların kime ait
          olduğunu işaretler.
        </p>
      </div>
    </main>
  );
}
