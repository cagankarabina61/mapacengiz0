"use client";
// Mobilde katlanabilir, masaüstünde HER ZAMAN açık bölüm gövdesi.
//
// Native <details> kullanılmadı: "telefonda kapalı, masaüstünde zorunlu açık"
// CSS ile ifade edilemez — `open` özniteliğini zorlayacak bir kural yok.
// children sunucuda render edilip prop olarak geçer; bu ada yalnızca
// görünürlüğü çevirir, içeriği istemciye taşımaz.
import { useState, type ReactNode } from "react";

export function CollapsibleBody({
  children,
  defaultOpen = true,
  openLabel = "Göster",
  closeLabel = "Gizle",
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  openLabel?: string;
  closeLabel?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <div className={open ? "block" : "hidden md:block"}>{children}</div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="md:hidden w-full min-h-11 text-sm font-medium text-blue-700 border-t border-gray-100 mt-2"
      >
        {open ? closeLabel : openLabel}
      </button>
    </>
  );
}
