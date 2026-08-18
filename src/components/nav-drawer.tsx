"use client";
// Mobil gezinme çekmecesi — telefondan TÜM sayfalara ve aramaya erişim.
//
// Bundan önce 16 maddelik NAV `hidden md:flex` aside içindeydi; alt menüde
// yalnızca 5 link vardı. 19 rotanın 11'ine telefondan hiçbir yol yoktu.
//
// Çıkış server action'ı prop olarak geçer — Server Action'lar RSC sınırından
// serileştirilebilir, bu yüzden istemci bileşeninde <form action={...}> çalışır.
import { useState, type ReactNode } from "react";
import { Sheet } from "@/components/sheet";
import { NavLink } from "@/components/nav-link";
import { NAV } from "@/components/nav-items";

export function NavDrawer({
  userName,
  roleLabel,
  signOutAction,
  searchForm,
}: {
  userName: string;
  roleLabel: string;
  signOutAction: () => Promise<void>;
  /** Sunucuda render edilmiş SearchForm. */
  searchForm: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menüyü aç"
        aria-expanded={open}
        className="min-h-11 min-w-11 -ml-2 flex items-center justify-center text-white text-xl"
      >
        ☰
      </button>

      <Sheet open={open} onClose={close} title="Menü" side="left">
        <div className="mb-3">{searchForm}</div>

        <nav className="space-y-1">
          {NAV.map((item, i) =>
            "section" in item ? (
              <p
                key={`s-${i}`}
                className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
              >
                {item.section}
              </p>
            ) : (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                onNavigate={close}
              />
            )
          )}
        </nav>

        <div className="mt-4 pt-4 border-t border-slate-700 text-xs space-y-2">
          <div>
            <p className="font-medium">{userName}</p>
            <p className="text-slate-400">{roleLabel}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex items-center min-h-11 text-slate-300 hover:text-white underline"
            >
              Çıkış Yap
            </button>
          </form>
        </div>
      </Sheet>
    </>
  );
}
