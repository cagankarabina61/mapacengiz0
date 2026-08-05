// Minimal UI primitifleri (madde 3: hız/okunabilirlik > süs).
// Renk asla tek bilgi kaynağı değildir — her rozette yazılı etiket vardır (madde 47).
import Link from "next/link";
import type { ReactNode } from "react";

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      {title && <h2 className="text-sm font-semibold text-gray-700 mb-3">{title}</h2>}
      {children}
    </section>
  );
}

type BadgeTone = "green" | "yellow" | "red" | "blue" | "gray";

const TONE_CLASSES: Record<BadgeTone, string> = {
  green: "bg-green-100 text-green-800 border-green-300",
  yellow: "bg-amber-100 text-amber-800 border-amber-300",
  red: "bg-red-100 text-red-800 border-red-300",
  blue: "bg-blue-100 text-blue-800 border-blue-300",
  gray: "bg-gray-100 text-gray-700 border-gray-300",
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded border text-xs font-medium whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

// Durum → renk eşlemesi (madde 47): Yeşil=Tamam/Hazır, Sarı=Risk/Bekliyor,
// Kırmızı=Bloke/Kritik/Gecikmiş, Mavi=Planlandı/Bilgi
const STATUS_TONES: Record<string, BadgeTone> = {
  TAMAMLANDI: "green",
  KABUL_EDILDI: "green",
  BETON_DOKUMUNE_HAZIR: "green",
  GECTI: "green",
  YAPILDI: "green",
  KABUL: "green",
  COZULDU: "green",
  KAPATILDI: "green",
  CEVAPLANDI: "green",

  KONTROL_BEKLIYOR: "yellow",
  ONAY_BEKLIYOR: "yellow",
  BEKLIYOR: "yellow",
  TEST_BEKLIYOR: "yellow",
  BETON_BEKLIYOR: "yellow",
  DELGI_BEKLIYOR: "yellow",
  CEVAP_BEKLENIYOR: "yellow",
  RISKLI: "yellow",
  SARTLI_GECTI: "yellow",
  HAZIR_DEGIL: "yellow",
  DUZELTME_YAPILIYOR: "yellow",

  PROBLEMLI: "red",
  BLOKE: "red",
  KALDI: "red",
  ACIK: "red",
  RED: "red",
  GECIKMIS: "red",
  IPTAL: "red",

  PLANLANDI: "blue",
  PLANLANMADI: "gray",
  BASLANMADI: "gray",
  BASLANABILIR: "yellow", // başlanabilir ≠ imalata hazır (madde 6)
  IMALATA_HAZIR: "green",
  TASLAK: "gray",
  GONDERILDI: "blue",
  BILGILENDIRME: "gray",
  UYARI: "yellow",
  BLOKAJ: "red",
  KRITIK: "red",
  BILGI: "gray",

  DEVAM_EDIYOR: "blue",
  DELGI_DEVAM_EDIYOR: "blue",
  DELGI_TAMAMLANDI: "blue",
  DONATI_KAFESI_HAZIRLANIYOR: "blue",
  DONATI_KAFESI_HAZIR: "blue",
  BETONLANDI: "blue",
  TEST_YAPILDI: "blue",
  BETON_DOKULUYOR: "blue",
};

export function StatusBadge({ status, labelText }: { status: string; labelText: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "gray"}>{labelText}</Badge>;
}

export function Button({
  children,
  type = "button",
  variant = "primary",
  disabled,
  className = "",
}: {
  children: ReactNode;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  const variants = {
    primary: "bg-blue-700 hover:bg-blue-800 text-white",
    secondary: "bg-white hover:bg-gray-50 text-gray-800 border border-gray-300",
    danger: "bg-red-700 hover:bg-red-800 text-white",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      className={`px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const variants = {
    primary: "bg-blue-700 hover:bg-blue-800 text-white",
    secondary: "bg-white hover:bg-gray-50 text-gray-800 border border-gray-300",
  };
  return (
    <Link href={href} className={`inline-block px-4 py-2 rounded-md text-sm font-medium ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

export function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-gray-500 py-6 text-center">{message}</p>;
}

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
      <h1 className="text-xl font-bold text-gray-900">{children}</h1>
      {actions}
    </div>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-300 text-left">
            {headers.map((h) => (
              <th key={h} className="py-2 px-2 font-semibold text-gray-600 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  );
}
