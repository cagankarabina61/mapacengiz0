"use client";
// Aktif durumu bilen gezinme bağlantısı. Tek uygulama, üç tüketici:
// masaüstü kenar menüsü, mobil çekmece, mobil alt menü.
// Bu eklenmeden önce hiçbir yer usePathname() çağırmıyordu — 16 maddelik
// kenar menüsü kullanıcının nerede olduğuna dair sıfır geri bildirim veriyordu.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath } from "@/components/nav-items";

type Variant = "sidebar" | "bottom";

export function NavLink({
  href,
  label,
  variant = "sidebar",
  onNavigate,
}: {
  href: string;
  label: string;
  variant?: Variant;
  /** Çekmecede: tıklandığında paneli kapatmak için. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);

  const className =
    variant === "bottom"
      ? `flex-1 min-h-14 flex flex-col items-center justify-center text-[11px] font-medium border-t-2 transition-colors duration-150 ${
          active
            ? "text-accent border-accent bg-accent-soft"
            : "text-slate-600 border-transparent"
        }`
      : `block px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 ${
          active
            ? "bg-accent text-white font-semibold shadow-[var(--shadow-card)]"
            : "text-nav-text hover:bg-nav-soft hover:text-white"
        }`;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={className}
    >
      {label}
    </Link>
  );
}
