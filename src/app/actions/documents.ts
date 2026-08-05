"use server";
// Doküman/fotoğraf yükleme (madde 41/50): dosya diske, kayıt Attachment'a.
import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertPermission, YetkiHatasi } from "@/lib/permissions";
import type { ActionResult } from "@/app/actions/piles";
import type { FileType } from "@prisma/client";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const ALLOWED_EXTENSIONS: Record<string, FileType> = {
  ".jpg": "FOTOGRAF",
  ".jpeg": "FOTOGRAF",
  ".png": "FOTOGRAF",
  ".webp": "FOTOGRAF",
  ".pdf": "PDF",
  ".xlsx": "EXCEL",
  ".xls": "EXCEL",
  ".dwg": "DIGER",
  ".docx": "DIGER",
};

const VALID_ENTITY_TYPES = new Set([
  "Structure",
  "StructureElement",
  "Pile",
  "ConcretePour",
  "Segment",
  "NCR",
  "RFI",
  "Issue",
]);

export async function uploadDocument(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await assertPermission(session.user.role, "attachment", "create");

    const file = formData.get("file");
    const entityType = String(formData.get("entityType") ?? "");
    const entityId = String(formData.get("entityId") ?? "");

    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Dosya seçilmedi." };
    }
    if (!VALID_ENTITY_TYPES.has(entityType) || !entityId) {
      return { ok: false, message: "Dokümanın bağlanacağı kayıt seçilmelidir." };
    }

    const ext = path.extname(file.name).toLocaleLowerCase("en");
    const fileType = ALLOWED_EXTENSIONS[ext];
    if (!fileType) {
      return {
        ok: false,
        message: `Desteklenmeyen dosya türü (${ext || "uzantısız"}). İzin verilenler: ${Object.keys(ALLOWED_EXTENSIONS).join(", ")}`,
      };
    }
    if (file.size > 50 * 1024 * 1024) {
      return { ok: false, message: "Dosya 50 MB sınırını aşıyor." };
    }

    // Bağlanan kaydın gerçekten var olduğunu doğrula (madde 55)
    const entityExists = await (async () => {
      switch (entityType) {
        case "Structure":
          return !!(await prisma.structure.findUnique({ where: { id: entityId } }));
        case "StructureElement":
          return !!(await prisma.structureElement.findUnique({ where: { id: entityId } }));
        case "Pile":
          return !!(await prisma.pile.findUnique({ where: { id: entityId } }));
        case "ConcretePour":
          return !!(await prisma.concretePour.findUnique({ where: { id: entityId } }));
        case "Segment":
          return !!(await prisma.balancedCantileverSegment.findUnique({ where: { id: entityId } }));
        case "NCR":
          return !!(await prisma.nCR.findUnique({ where: { id: entityId } }));
        case "RFI":
          return !!(await prisma.rFI.findUnique({ where: { id: entityId } }));
        default:
          return false;
      }
    })();
    if (!entityExists) return { ok: false, message: "Dokümanın bağlanacağı kayıt bulunamadı." };

    await mkdir(UPLOAD_DIR, { recursive: true });
    const storedName = `${crypto.randomUUID()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, storedName), buffer);

    await prisma.attachment.create({
      data: {
        entityType,
        entityId,
        fileType,
        fileName: file.name,
        filePath: storedName,
        uploadedById: session.user.id,
      },
    });

    revalidatePath("/dokumanlar");
    return { ok: true, message: `"${file.name}" yüklendi.` };
  } catch (e) {
    if (e instanceof YetkiHatasi) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Dosya yüklenirken beklenmeyen bir hata oluştu." };
  }
}
