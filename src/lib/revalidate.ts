// Güvenli revalidate — form verisinden gelen yol ASLA doğrudan
// revalidatePath'e verilmez. Yalnızca bilinen rota köklerine izin verilir.
import { revalidatePath } from "next/cache";

const ALLOWED_ROOTS = [
  "/",
  "/bugun",
  "/beton",
  "/bloke",
  "/yapilar",
  "/planlama",
  "/kazik",
  "/segmentler",
  "/rfi",
  "/ncr",
  "/cizimler",
  "/dokumanlar",
  "/qaqc",
  "/raporlar",
  "/ara",
  "/import",
] as const;

/**
 * `from` bir kullanıcı girdisidir (gizli form alanı). Sorgu dizesi atılır,
 * yalnızca ilk yol parçası beyaz listeye karşı doğrulanır.
 */
export function safeRevalidate(from?: string | null): void {
  if (!from || !from.startsWith("/")) return;
  const pathOnly = from.split("?")[0].split("#")[0];
  const root = "/" + (pathOnly.split("/")[1] ?? "");
  if ((ALLOWED_ROOTS as readonly string[]).includes(pathOnly)) {
    revalidatePath(pathOnly);
    return;
  }
  if ((ALLOWED_ROOTS as readonly string[]).includes(root)) {
    revalidatePath(pathOnly);
  }
}
