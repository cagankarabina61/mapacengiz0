"use client";
// Mobil üst çubuktaki sayfa başlığı. Önceden her sayfada "Sanat Yapıları"
// yazıyordu — telefon kullanıcısı nerede olduğunu göremiyordu.
import { usePathname } from "next/navigation";
import { labelForPath } from "@/components/nav-items";

export function CurrentPageTitle() {
  return <span className="font-bold text-sm truncate">{labelForPath(usePathname())}</span>;
}
