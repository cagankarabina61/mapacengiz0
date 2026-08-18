"use client";
// Tek bileşen, iki biçim: md altında alttan sheet, md+ sağdan çekmece.
//
// Native <dialog> tercih edilmedi: showModal() imperatif olarak effect'ten
// sürülmek zorunda, React state'iyle çakışıyor ve top-layer'ı Tailwind ile
// biçimlendirmek zor. Portal + fixed div daha küçük ve yeterli.
//
// z-index: overlay z-40, panel z-50 — ikisi de mobil üst çubuk/alt menüdeki
// z-10'u aşmalıdır.
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Hidrasyon nöbetçisi: createPortal document gerektirir, sunucuda yoktur.
// useState+useEffect yerine useSyncExternalStore — effect içinde setState
// çağırmadan "istemcide miyiz?" sorusunu yanıtlar (cascading render yok).
const neverChanges = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  side = "bottom",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** "bottom": mobilde alttan, md+ sağdan. "left": gezinme çekmecesi. */
  side?: "bottom" | "left";
}) {
  const mounted = useSyncExternalStore(neverChanges, onClient, onServer);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const panelClass =
    side === "left"
      ? "fixed inset-y-0 left-0 w-[85vw] max-w-xs bg-nav text-slate-100 z-50 overflow-y-auto flex flex-col shadow-[var(--shadow-overlay)]"
      : "fixed inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl bg-surface text-slate-900 z-50 overflow-y-auto " +
        "pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-overlay)] " +
        "md:inset-y-0 md:right-0 md:left-auto md:w-[28rem] md:max-h-none md:rounded-none md:rounded-l-2xl md:pb-0";

  const headerClass =
    side === "left"
      ? "sticky top-0 bg-nav border-b border-white/10 px-4 py-3 flex items-center justify-between"
      : "sticky top-0 bg-surface border-b border-slate-200 px-4 py-3 flex items-center justify-between";

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div role="dialog" aria-modal="true" aria-label={title} className={panelClass}>
        <div className={headerClass}>
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="min-h-11 min-w-11 -mr-2 text-current opacity-60 hover:opacity-100 text-lg"
          >
            ✕
          </button>
        </div>
        <div className="p-4 flex-1">{children}</div>
        {footer && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">{footer}</div>
        )}
      </div>
    </>,
    document.body
  );
}
