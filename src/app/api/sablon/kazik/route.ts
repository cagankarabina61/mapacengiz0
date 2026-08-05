// Kazık import şablonu (madde 37): doğru başlıklarla boş xlsx.
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { PILE_IMPORT_HEADERS } from "@/lib/import-format";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Kazık Listesi");
  sheet.addRow([...PILE_IMPORT_HEADERS]);
  sheet.getRow(1).font = { bold: true };
  sheet.addRow(["VIA11-P05-PILE-09", "VIA11-P05", 1500, 25, "C30/37"]);
  sheet.getRow(2).font = { italic: true, color: { argb: "FF9CA3AF" } };
  sheet.columns.forEach((c) => (c.width = 22));

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="kazik-import-sablonu.xlsx"`,
    },
  });
}
