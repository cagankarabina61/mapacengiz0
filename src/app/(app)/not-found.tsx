import Link from "next/link";
import { buttonPrimary } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-lg mx-auto mt-8">
      <h1 className="text-lg font-bold text-gray-900 mb-2">Sayfa bulunamadı</h1>
      <p className="text-sm text-gray-600 mb-4">
        Aradığınız kayıt silinmiş, arşivlenmiş veya adres yanlış yazılmış olabilir.
      </p>
      <Link href="/" className={buttonPrimary}>
        Ana sayfaya dön
      </Link>
    </div>
  );
}
