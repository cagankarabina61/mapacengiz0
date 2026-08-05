// Render health check endpoint — DB'ye hiç dokunmaz, her zaman anında 200 döner.
// Amaç: Render'ın health check'i DB yavaşlığı/soğuk başlangıç yüzünden servisi
// yanlışlıkla "sağlıksız" görüp yeniden başlatmasın.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true });
}
