import Link from "next/link";
import { requireSession, signOut } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/labels";

// Masaüstü: sol menü (madde 75 sırası). Mobil: alt menü, öncelik Bugün/Beton/Bloke (madde 74).
const NAV: ({ href: string; label: string } | { section: string })[] = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/bugun", label: "Bugün" },
  { href: "/planlama", label: "Planlama" },
  { href: "/yapilar", label: "Yapılar" },
  { href: "/beton", label: "Beton" },
  { href: "/kazik", label: "Kazık" },
  { href: "/segmentler", label: "Dengeli Konsol" },
  { href: "/bloke", label: "Bloke İşler" },
  { section: "Teknik Ofis" },
  { href: "/rfi", label: "RFI" },
  { href: "/cizimler", label: "Çizimler" },
  { href: "/dokumanlar", label: "Dokümanlar" },
  { section: "QA/QC" },
  { href: "/qaqc", label: "ITP Kontrolleri" },
  { href: "/ncr", label: "NCR" },
  { section: "Diğer" },
  { href: "/raporlar", label: "Raporlar" },
  { href: "/import", label: "Excel İçe Aktar" },
];

const MOBILE_NAV = [
  { href: "/bugun", label: "Bugün" },
  { href: "/beton", label: "Beton" },
  { href: "/bloke", label: "Bloke" },
  { href: "/planlama", label: "Plan" },
  { href: "/", label: "Ana Sayfa" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  async function cikis() {
    "use server";
    await signOut({ redirectTo: "/giris" });
  }

  return (
    <div className="flex-1 flex">
      {/* Masaüstü kenar menüsü */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-slate-900 text-slate-100 min-h-screen sticky top-0">
        <div className="p-4 border-b border-slate-700">
          <p className="font-bold text-sm leading-tight">Sanat Yapıları</p>
          <p className="text-xs text-slate-400">Üretim Kontrol Merkezi</p>
        </div>
        <form action="/ara" method="get" className="px-3 pt-3">
          <input
            name="q"
            placeholder="Ara: VIA11 P5…"
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </form>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {NAV.map((item, i) =>
            "section" in item ? (
              <p
                key={`s-${i}`}
                className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
              >
                {item.section}
              </p>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="block px-3 py-2 rounded text-sm hover:bg-slate-700"
              >
                {item.label}
              </Link>
            )
          )}
        </nav>
        <div className="p-4 border-t border-slate-700 text-xs space-y-2">
          <div>
            <p className="font-medium">{session.user.name}</p>
            <p className="text-slate-400">{ROLE_LABELS[session.user.role]}</p>
          </div>
          <form action={cikis}>
            <button type="submit" className="text-slate-300 hover:text-white underline">
              Çıkış Yap
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobil üst çubuk */}
        <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <span className="font-bold text-sm">Sanat Yapıları</span>
          <form action={cikis}>
            <button type="submit" className="text-xs text-slate-300 underline">
              Çıkış
            </button>
          </form>
        </header>

        <main className="flex-1 p-4 pb-20 md:pb-4 max-w-6xl w-full mx-auto">{children}</main>

        {/* Mobil alt menü — büyük dokunma alanları (madde 42) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex z-10">
          {MOBILE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 py-3 text-center text-xs font-medium text-gray-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
