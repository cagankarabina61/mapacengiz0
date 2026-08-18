// Minimal UI primitifleri (madde 3: hız/okunabilirlik > süs).
// Renk asla tek bilgi kaynağı değildir — her rozette yazılı etiket vardır (madde 47).
import Link from "next/link";
import type { ReactNode } from "react";

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section
      className={`bg-surface rounded-xl p-4 ring-1 ring-slate-900/5 shadow-[var(--shadow-card)] ${className}`}
    >
      {title && (
        <h2 className="text-sm font-semibold text-slate-800 mb-3 tracking-tight">{title}</h2>
      )}
      {children}
    </section>
  );
}

type BadgeTone = "green" | "yellow" | "red" | "blue" | "gray";

// Rozet tonları — metin renkleri WCAG AA (≥4.5:1) sağlar; renk tek başına
// bilgi taşımaz, her rozette yazılı etiket vardır (madde 47).
const TONE_CLASSES: Record<BadgeTone, string> = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  yellow: "bg-amber-50 text-amber-900 ring-amber-600/25",
  red: "bg-red-50 text-red-800 ring-red-600/20",
  blue: "bg-blue-50 text-blue-800 ring-blue-600/20",
  gray: "bg-slate-100 text-slate-700 ring-slate-500/20",
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md ring-1 ring-inset text-xs font-medium whitespace-nowrap ${TONE_CLASSES[tone]}`}
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

// Buton sınıf dizeleri — inputClass ile aynı desen.
// İstemci adaları onClick gerektirdiği için <Button> kullanamaz; sınıfı
// import edip kendi <button>'ını yazar. min-h-11 = 44px dokunma hedefi.
export const buttonClass =
  "inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-lg text-sm font-medium " +
  "transition-colors duration-150 active:scale-[0.98] " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";
export const buttonPrimary = `${buttonClass} bg-accent hover:bg-accent-hover text-white shadow-[var(--shadow-card)]`;
export const buttonSecondary = `${buttonClass} bg-surface hover:bg-slate-50 text-slate-800 ring-1 ring-inset ring-slate-300 shadow-[var(--shadow-card)]`;
export const buttonDanger = `${buttonClass} bg-red-700 hover:bg-red-800 text-white shadow-[var(--shadow-card)]`;
/** Excel/dışa aktarma — yeşil, sektörde tablo indirmenin yerleşik rengi. */
export const buttonSuccess = `${buttonClass} bg-emerald-700 hover:bg-emerald-800 text-white shadow-[var(--shadow-card)]`;
/** Arşivleme gibi geri alınabilir ama dikkat gerektiren işlemler. */
export const buttonWarning = `${buttonClass} bg-amber-600 hover:bg-amber-700 text-white shadow-[var(--shadow-card)]`;
/** Koyu ikincil — form içi ağır işlemler. */
export const buttonNeutral = `${buttonClass} bg-slate-700 hover:bg-slate-800 text-white shadow-[var(--shadow-card)]`;

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
    primary: buttonPrimary,
    secondary: buttonSecondary,
    danger: buttonDanger,
  };
  return (
    <button type={type} disabled={disabled} className={`${variants[variant]} ${className}`}>
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
  const variants = { primary: buttonPrimary, secondary: buttonSecondary };
  return (
    <Link href={href} className={`${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}

// Filtre/sekme çipleri — beş sayfada bağımsız olarak yeniden yazılmış
// koşullu sınıf dizelerinin tek karşılığı. Link tabanlı: URL durumdur.
export function Chips({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex gap-2 flex-wrap items-center ${className}`}>{children}</div>;
}

export function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center justify-center min-h-11 px-3.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
        active
          ? "bg-accent text-white shadow-[var(--shadow-card)]"
          : "bg-surface text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {children}
    </Link>
  );
}

/** Çip grupları arasındaki dikey ayraç. */
export function ChipDivider() {
  return <span className="w-px self-stretch bg-slate-300 mx-1" aria-hidden="true" />;
}

export function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
    </label>
  );
}

// min-h-11 = 44px dokunma hedefi; eldivenli parmak için zorunlu.
export const inputClass =
  "w-full min-h-11 rounded-lg px-3 py-2 text-sm bg-surface text-slate-900 " +
  "ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 " +
  "focus:outline-none focus:ring-2 focus:ring-accent";

export function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-muted py-8 text-center">{message}</p>;
}

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
      <h1 className="text-xl font-bold text-slate-900 tracking-tight">{children}</h1>
      {actions}
    </div>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left">
            {headers.map((h) => (
              <th
                key={h}
                className="bg-surface-muted first:rounded-l-md last:rounded-r-md py-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}
