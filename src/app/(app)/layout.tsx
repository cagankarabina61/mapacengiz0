import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/labels";
import { NAV, MOBILE_NAV } from "@/components/nav-items";
import { NavLink } from "@/components/nav-link";
import { NavDrawer } from "@/components/nav-drawer";
import { SearchForm } from "@/components/search-form";
import { CurrentPageTitle } from "@/components/current-page-title";

// Masaüstü: sol menü (madde 75 sırası). Mobil: hamburger çekmece (tüm sayfalar)
// + alt menüde öne çıkan 5 hedef (madde 74). Gezinme verisi tek kaynaktan
// (components/nav-items.ts) gelir; mobil ve masaüstü ayrışamaz.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="flex-1 flex">
      {/* Masaüstü kenar menüsü */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-nav text-slate-100 min-h-screen sticky top-0">
        <div className="px-4 py-4 border-b border-white/10">
          <p className="font-bold text-sm leading-tight tracking-tight">Sanat Yapıları</p>
          <p className="text-xs text-slate-400 mt-0.5">Üretim Kontrol Merkezi</p>
        </div>
        <SearchForm className="px-3 pt-3" />
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map((item, i) =>
            "section" in item ? (
              <p
                key={`s-${i}`}
                className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
              >
                {item.section}
              </p>
            ) : (
              <NavLink key={item.href} href={item.href} label={item.label} />
            )
          )}
        </nav>
        <div className="p-4 border-t border-white/10 text-xs space-y-2">
          <div>
            <p className="font-medium text-slate-100">{session.user.name}</p>
            <p className="text-slate-400">{ROLE_LABELS[session.user.role]}</p>
          </div>
          <Link
            href="/giris?degistir=1"
            className="text-slate-400 hover:text-white transition-colors duration-150"
          >
            Kullanıcıyı değiştir
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobil üst çubuk — hamburger + mevcut sayfa adı */}
        <header className="md:hidden bg-nav text-white px-4 py-2 flex items-center gap-3 sticky top-0 z-10 shadow-[var(--shadow-raised)]">
          <NavDrawer
            userName={session.user.name}
            roleLabel={ROLE_LABELS[session.user.role]}
            searchForm={<SearchForm />}
          />
          <CurrentPageTitle />
          <Link
            href="/giris?degistir=1"
            className="ml-auto inline-flex items-center min-h-11 text-xs text-slate-300 underline"
          >
            {session.user.name}
          </Link>
        </header>

        <main className="flex-1 p-4 pb-24 md:pb-4 max-w-6xl lg:max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Mobil alt menü — 56px dokunma alanları, aktif durum vurgulu (madde 42) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-slate-200 flex z-10 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_-4px_rgb(15_23_42_/_0.12)]">
          {MOBILE_NAV.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} variant="bottom" />
          ))}
        </nav>
      </div>
    </div>
  );
}
