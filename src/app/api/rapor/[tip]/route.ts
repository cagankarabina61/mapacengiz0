// Rapor Excel çıktısı (madde 37/46): aynı rapor servisinden xlsx üretir.
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { REPORTS } from "@/lib/services/reports";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tip: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }

  const { tip } = await params;
  const report = REPORTS[tip];
  if (!report) {
    return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 });
  }

  const def = await report.run();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(def.title.slice(0, 31));

  sheet.addRow(def.headers);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE5E7EB" },
  };
  for (const row of def.rows) sheet.addRow(row);

  sheet.columns.forEach((col, i) => {
    const headerLen = def.headers[i]?.length ?? 10;
    let max = headerLen;
    for (const row of def.rows) {
      const len = String(row[i] ?? "").length;
      if (len > max) max = len;
    }
    col.width = Math.min(Math.max(max + 2, 10), 60);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `${def.key}-raporu-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
