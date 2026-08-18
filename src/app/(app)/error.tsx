"use client";
import { useEffect } from "react";
import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="bg-white border border-red-200 rounded-lg p-6 max-w-lg mx-auto mt-8">
      <h1 className="text-lg font-bold text-gray-900 mb-2">Bir hata oluştu</h1>
      <p className="text-sm text-gray-600 mb-1">
        Sayfa yüklenirken beklenmeyen bir sorun çıktı. Tekrar denemek sorunu genellikle çözer.
      </p>
      {error.digest && (
        <p className="text-xs text-slate-500 mb-4">Hata kodu: {error.digest}</p>
      )}
      <div className="flex gap-2 mt-4 flex-wrap">
        <button type="button" onClick={reset} className={buttonPrimary}>
          Tekrar dene
        </button>
        <Link href="/" className={buttonSecondary}>
          Ana sayfaya dön
        </Link>
      </div>
    </div>
  );
}
