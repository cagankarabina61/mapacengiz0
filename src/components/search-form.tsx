// Global arama formu — SUNUCU bileşeni, hem masaüstü kenar menüsünde
// hem mobil çekmecede render edilir.
//
// Önceden yalnızca `hidden md:flex` aside içindeydi: "her şeyi hızlı bul"
// girişi, ona en çok ihtiyaç duyulan cihazda erişilemezdi.
export function SearchForm({ className = "" }: { className?: string }) {
  return (
    <form action="/ara" method="get" className={className} role="search">
      <label htmlFor="global-search" className="sr-only">
        Ara
      </label>
      <input
        id="global-search"
        name="q"
        placeholder="Ara: VIA11 P5…"
        className="w-full bg-slate-800 border border-slate-600 rounded px-3 min-h-11 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
    </form>
  );
}
