// Excel içe aktarma (madde 37/69): kazık listesi.
import { Card, PageTitle } from "@/components/ui";
import { ImportPanel } from "./import-client";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <div className="space-y-4">
      <PageTitle>Excel İçe Aktarma — Kazık Listesi</PageTitle>
      <Card>
        <p className="text-sm text-gray-600 mb-4">
          Beklenen sütunlar: <strong>Kazık Kodu | Eleman Kodu | Çap (mm) | Tasarım Boyu (m) |
          Beton Sınıfı</strong>. Önce önizleme yapılır; hatalı satırlar işaretlenir ve yalnızca
          onayladığınız geçerli satırlar aktarılır. Excel ana veri kaynağı değildir — aktarım
          sonrası tüm takip sistem üzerinden yürür.
        </p>
        <ImportPanel />
      </Card>
    </div>
  );
}
