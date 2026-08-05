"use server";
// Excel kazık import (madde 37/69): Yükle → Parse → Önizleme/Validasyon → Onay → Transaction.
// Excel asla ana veri kaynağı değildir; yalnızca giriş formatıdır.
import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertPermission, YetkiHatasi } from "@/lib/permissions";
import { AKTIF } from "@/lib/archive";
import {
  PILE_IMPORT_HEADERS,
  type ImportRowPreview,
  type ImportPreviewResult,
} from "@/lib/import-format";

const EXPECTED_HEADERS = PILE_IMPORT_HEADERS;

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "text" in v) return String(v.text).trim();
  if (typeof v === "object" && "result" in v) return String(v.result ?? "").trim();
  return String(v).trim();
}

export async function previewPileImport(formData: FormData): Promise<ImportPreviewResult> {
  const empty = { rows: [], validCount: 0, errorCount: 0 };
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "pile", "create");

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Dosya seçilmedi.", ...empty };
    }
    if (!file.name.toLocaleLowerCase("en").endsWith(".xlsx")) {
      return { ok: false, message: "Yalnızca .xlsx dosyaları desteklenir.", ...empty };
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet) return { ok: false, message: "Excel dosyasında sayfa bulunamadı.", ...empty };

    // Başlık kontrolü
    const headerRow = sheet.getRow(1);
    const headers = EXPECTED_HEADERS.map((_, i) => cellText(headerRow.getCell(i + 1).value));
    const headerMismatch = EXPECTED_HEADERS.some(
      (h, i) => headers[i].toLocaleLowerCase("tr") !== h.toLocaleLowerCase("tr")
    );
    if (headerMismatch) {
      return {
        ok: false,
        message: `Başlık satırı beklenen formatta değil. Beklenen sütunlar: ${EXPECTED_HEADERS.join(" | ")}. Şablonu indirip kullanabilirsiniz.`,
        ...empty,
      };
    }

    // Mevcut kodlar ve elemanlar
    const [existingPiles, elements] = await Promise.all([
      prisma.pile.findMany({ select: { code: true } }),
      prisma.structureElement.findMany({
        where: AKTIF,
        select: { id: true, code: true, pileGroups: { select: { id: true } } },
      }),
    ]);
    const existingCodes = new Set(existingPiles.map((p) => p.code));
    const elementByCode = new Map(elements.map((e) => [e.code.toLocaleUpperCase("en"), e]));

    const rows: ImportRowPreview[] = [];
    const seenInFile = new Set<string>();

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // başlık
      const code = cellText(row.getCell(1).value);
      const elementCode = cellText(row.getCell(2).value);
      const diameterRaw = cellText(row.getCell(3).value);
      const lengthRaw = cellText(row.getCell(4).value).replace(",", ".");
      const concreteClass = cellText(row.getCell(5).value) || null;

      if (!code && !elementCode && !diameterRaw && !lengthRaw) return; // boş satır

      const errors: string[] = [];
      if (!code) errors.push("Kazık kodu boş.");
      if (code && existingCodes.has(code)) errors.push("Bu kod zaten sistemde kayıtlı.");
      if (code && seenInFile.has(code)) errors.push("Bu kod dosyada birden fazla kez geçiyor.");
      if (code) seenInFile.add(code);

      if (!elementCode) errors.push("Eleman kodu boş.");
      else if (!elementByCode.has(elementCode.toLocaleUpperCase("en")))
        errors.push(`"${elementCode}" kodlu eleman sistemde yok.`);

      let diameterMm: number | null = null;
      if (diameterRaw) {
        const n = Number(diameterRaw);
        if (Number.isNaN(n) || n <= 0) errors.push("Çap pozitif bir sayı olmalı.");
        else diameterMm = Math.round(n);
      }
      let designLengthM: number | null = null;
      if (lengthRaw) {
        const n = Number(lengthRaw);
        if (Number.isNaN(n) || n <= 0) errors.push("Boy pozitif bir sayı olmalı.");
        else designLengthM = n;
      }

      rows.push({ rowNumber, code, elementCode, diameterMm, designLengthM, concreteClass, errors });
    });

    if (rows.length === 0) {
      return { ok: false, message: "Dosyada veri satırı bulunamadı.", ...empty };
    }

    const validCount = rows.filter((r) => r.errors.length === 0).length;
    return {
      ok: true,
      message: `${rows.length} satır okundu: ${validCount} geçerli, ${rows.length - validCount} hatalı.`,
      rows,
      validCount,
      errorCount: rows.length - validCount,
    };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message, ...empty };
    console.error(e);
    return { ok: false, message: "Dosya okunurken beklenmeyen bir hata oluştu.", ...empty };
  }
}

export async function confirmPileImport(formData: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "pile", "create");

    const payload = String(formData.get("payload") ?? "");
    let rows: ImportRowPreview[];
    try {
      rows = JSON.parse(payload);
    } catch {
      return { ok: false, message: "Önizleme verisi çözümlenemedi. Lütfen tekrar deneyin." };
    }
    const valid = rows.filter((r) => r.errors.length === 0);
    if (valid.length === 0) return { ok: false, message: "Aktarılacak geçerli satır yok." };

    // Sunucu tarafında YENİDEN doğrula (önizleme ile DB arasında değişiklik olabilir)
    const elements = await prisma.structureElement.findMany({
      where: AKTIF,
      select: { id: true, code: true, pileGroups: { select: { id: true } } },
    });
    const elementByCode = new Map(elements.map((e) => [e.code.toLocaleUpperCase("en"), e]));
    const existing = new Set(
      (await prisma.pile.findMany({ select: { code: true } })).map((p) => p.code)
    );

    let created = 0;
    await prisma.$transaction(async (tx) => {
      for (const row of valid) {
        if (existing.has(row.code)) continue; // önizleme sonrası eklenmişse atla
        const element = elementByCode.get(row.elementCode.toLocaleUpperCase("en"));
        if (!element) continue;
        let groupId = element.pileGroups[0]?.id;
        if (!groupId) {
          const group = await tx.pileGroup.create({
            data: { elementId: element.id, name: "Kazık Grubu", designPileCount: 0 },
          });
          groupId = group.id;
        }
        await tx.pile.create({
          data: {
            pileGroupId: groupId,
            code: row.code,
            diameterMm: row.diameterMm,
            designLengthM: row.designLengthM,
            concreteClass: row.concreteClass,
            status: "PLANLANDI",
          },
        });
        created++;
      }
      await tx.auditLog.create({
        data: {
          entityType: "Pile",
          entityId: "toplu-import",
          fieldName: "import",
          oldValue: null,
          newValue: `${created} kazık Excel'den içe aktarıldı`,
          changedById: session.user.id,
        },
      });
    });

    revalidatePath("/kazik");
    return { ok: true, message: `${created} kazık içe aktarıldı.` };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "İçe aktarma sırasında beklenmeyen bir hata oluştu." };
  }
}
