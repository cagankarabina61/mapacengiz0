// Gezinme verisi — düz veri, JSX yok. Hem sunucu hem istemci import eder.
// Tek kaynak: masaüstü kenar menüsü, mobil çekmece ve alt menü aynı diziden
// beslenir, böylece bir daha ayrışamazlar.

export type NavEntry = { href: string; label: string } | { section: string };

export const NAV: NavEntry[] = [
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

/** Alt menüde öne çıkan 5 hedef (madde 74). Tümüne çekmeceden erişilir. */
export const MOBILE_NAV = [
  { href: "/bugun", label: "Bugün" },
  { href: "/beton", label: "Beton" },
  { href: "/bloke", label: "Bloke" },
  { href: "/planlama", label: "Plan" },
  { href: "/", label: "Ana Sayfa" },
];

/**
 * Aktif bağlantı kuralı — alt rotalar üst girdiyi vurgular
 * (ör. /yapilar/VIA-11 → /yapilar).
 */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Mobil üst çubukta gösterilecek sayfa başlığı. */
export function labelForPath(pathname: string): string {
  let best: { href: string; label: string } | null = null;
  for (const item of NAV) {
    if ("section" in item) continue;
    if (!isActivePath(pathname, item.href)) continue;
    if (!best || item.href.length > best.href.length) best = item;
  }
  return best?.label ?? "Sanat Yapıları";
}
