// Yüklenen dosyaları oturum kontrolüyle sunar (uploads/ klasörü public değildir).
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) {
    return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
  }

  // filePath yalnızca bizim ürettiğimiz UUID'li ad — path traversal'e kapalı.
  const safeName = path.basename(attachment.filePath);
  const fullPath = path.join(process.cwd(), "uploads", safeName);
  try {
    const data = await readFile(fullPath);
    const ext = path.extname(safeName).toLocaleLowerCase("en");
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Dosya diskte bulunamadı." }, { status: 404 });
  }
}
