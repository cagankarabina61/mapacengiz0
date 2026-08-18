// Seed: YALNIZCA yapılandırma ve gerçek proje iskeleti yazar.
//
// ÖNEMLİ: Bu script HİÇBİR uydurma iş verisi üretmez (2026-08-18 kullanıcı kararı).
// Daha önce SP-DEMO/VIA-11 örnek projesi (iş kalemleri, kazıklar, segmentler,
// beton dökümleri, RFI, NCR, çizim) oluşturuluyordu; sahada gerçek sanılan
// rastgele bilgi ürettiği için tamamen kaldırıldı. Buraya bir daha örnek
// iş verisi EKLENMEMELİDİR — render.yaml her container başlangıcında
// `prisma db seed` çalıştırır, yani eklenen her şey üretime geri döner.
//
// Yazdıkları: kullanıcılar, rol izinleri, beton hazırlık kapısı kataloğu,
// aktivite/ITP şablonları, ekip-ekipman katalogu, varsayılan segment kapı
// kuralı ve VIA-1…VIA-48 boş yapı iskeleti (onaylı PTE'den teyitli).
// Tümü idempotent upsert — mevcut kayıtların üzerine yazmaz.
import { PrismaClient, RoleName, PourTargetType, ElementType, CheckpointType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  // ── Kullanıcılar (demo) ──────────────────────────────
  const users: { name: string; email: string; role: RoleName }[] = [
    { name: "Yönetici", email: "yonetici@santiye.local", role: "YONETICI" },
    { name: "Teknik Ofis", email: "teknikofis@santiye.local", role: "TEKNIK_OFIS" },
    { name: "Saha Mühendisi", email: "saha@santiye.local", role: "SAHA_MUHENDISI" },
    { name: "QA/QC", email: "qaqc@santiye.local", role: "QAQC" },
    { name: "Survey", email: "survey@santiye.local", role: "SURVEY" },
    { name: "İzleyici", email: "izleyici@santiye.local", role: "IZLEYICI" },
  ];
  // Kullanıcı oluşturma YALNIZCA veritabanı boşken çalışır. Kullanıcılar zaten
  // varsa hiç dokunulmaz — seed her container başlangıcında çalıştığı için
  // aksi hâlde çalışan bir kurulumu bozma riski olurdu.
  const eksikKullanicilar: typeof users = [];
  for (const u of users) {
    if (!(await prisma.user.findUnique({ where: { email: u.email } }))) {
      eksikKullanicilar.push(u);
    }
  }

  if (eksikKullanicilar.length > 0) {
    // Şifreli giriş kaldırıldı; kullanıcılar "Kim kullanıyor?" ekranından
    // seçiliyor. passwordHash sütunu şemada zorunlu olduğu için doldurulur
    // ama hiçbir yerde doğrulanmaz — giriş akışı yok.
    const kullanilmayanHash = await bcrypt.hash(randomUUID(), 10);
    for (const u of eksikKullanicilar) {
      await prisma.user.create({ data: { ...u, passwordHash: kullanilmayanHash } });
    }
    console.log(`${eksikKullanicilar.length} kullanıcı oluşturuldu.`);
  }

  // ── Rol izinleri (madde 39-40) ───────────────────────
  // resource anahtarları servis katmanındaki assertPermission ile birebir.
  const perms: [RoleName, string, string[]][] = [
    ["TEKNIK_OFIS", "structure", ["create", "update", "delete"]],
    ["TEKNIK_OFIS", "element", ["create", "update", "delete"]],
    ["TEKNIK_OFIS", "segment", ["create", "update"]],
    ["SAHA_MUHENDISI", "structure", ["create", "update"]],
    ["TEKNIK_OFIS", "activity", ["create", "update"]],
    ["TEKNIK_OFIS", "drawing", ["create", "update", "delete"]],
    ["TEKNIK_OFIS", "rfi", ["create", "update", "delete"]],
    ["TEKNIK_OFIS", "itpTemplate", ["create", "update"]],
    ["TEKNIK_OFIS", "concretePour", ["create", "update"]],
    ["TEKNIK_OFIS", "pourOverride", ["create"]],
    ["TEKNIK_OFIS", "attachment", ["create"]],
    ["QAQC", "attachment", ["create"]],
    ["SURVEY", "attachment", ["create"]],
    ["SAHA_MUHENDISI", "element", ["create", "update"]],
    ["SAHA_MUHENDISI", "activity", ["update"]],
    ["SAHA_MUHENDISI", "pile", ["create", "update"]],
    ["SAHA_MUHENDISI", "segment", ["create", "update"]],
    ["SAHA_MUHENDISI", "concretePour", ["create", "update"]],
    ["SAHA_MUHENDISI", "checklist", ["update"]],
    ["SAHA_MUHENDISI", "issue", ["create", "update"]],
    ["SAHA_MUHENDISI", "attachment", ["create"]],
    ["SAHA_MUHENDISI", "resourceBooking", ["create", "update"]],
    ["QAQC", "inspection", ["create", "update"]],
    ["QAQC", "ncr", ["create", "update"]],
    ["QAQC", "pourQaqc", ["update"]],
    ["QAQC", "pileTest", ["update"]],
    ["SURVEY", "pourSurvey", ["update"]],
    ["SURVEY", "surveyRecord", ["create", "update"]],
    // ── Not / elle dikkat kalemi (katmanlı düzenleme) ────
    // İZLEYİCİ dışında herkes not yazabilir; YONETICI zaten koşulsuz geçer.
    // Not silme yumuşaktır (deletedAt); sahiplik kuralı ayrıca canEditNote ile denetlenir.
    ["TEKNIK_OFIS", "note", ["create", "update", "delete"]],
    ["SAHA_MUHENDISI", "note", ["create", "update", "delete"]],
    ["QAQC", "note", ["create", "update", "delete"]],
    ["SURVEY", "note", ["create", "update", "delete"]],
    ["TEKNIK_OFIS", "attentionItem", ["create", "update", "delete"]],
    ["SAHA_MUHENDISI", "attentionItem", ["create", "update", "delete"]],
    ["QAQC", "attentionItem", ["create", "update", "delete"]],
    ["SURVEY", "attentionItem", ["create", "update", "delete"]],
  ];
  for (const [role, resource, actions] of perms) {
    for (const action of actions) {
      await prisma.rolePermission.upsert({
        where: { role_resource_action: { role, resource, action } },
        update: {},
        create: { role, resource, action },
      });
    }
  }

  // ── Beton hazırlık kapısı kataloğu (madde 11) ────────
  const ALL: PourTargetType[] = ["PILE", "STRUCTURE_ELEMENT", "SEGMENT"];
  const NO_PILE: PourTargetType[] = ["STRUCTURE_ELEMENT", "SEGMENT"];
  const checklist: [string, string, PourTargetType[]][] = [
    ["IFC_DRAWING", "Onaylı IFC çizimi mevcut", ALL],
    ["SHOP_DRAWING", "Onaylı shop drawing mevcut", ALL],
    ["REBAR_DONE", "Donatı tamamlandı", ALL],
    ["REBAR_CHECKED", "Donatı kontrol edildi", ALL],
    ["COVER_CHECKED", "Beton örtüsü kontrol edildi", ALL],
    ["FORMWORK_DONE", "Kalıp tamamlandı", NO_PILE],
    ["FORMWORK_CHECKED", "Kalıp ölçüleri kontrol edildi", NO_PILE],
    ["EMBEDDED_CHECKED", "Gömülü elemanlar kontrol edildi", NO_PILE],
    ["SURVEY_DONE", "Survey tamamlandı", ALL],
    ["QAQC_DONE", "QA/QC kontrolü tamamlandı", ALL],
    ["ITP_RELEASED", "ITP kontrol noktası serbest", ALL],
    ["MIX_APPROVED", "Beton reçetesi uygun", ALL],
    ["PUMP_PLANNED", "Beton pompası planlandı", ALL],
    ["CREW_READY", "Ekip hazır", ALL],
    ["VOLUME_CALCULATED", "Beton miktarı hesaplandı", ALL],
    ["ORDER_PLANNED", "Beton siparişi planlandı", ALL],
  ];
  let order = 1;
  for (const [itemKey, label, appliesTo] of checklist) {
    await prisma.checklistTemplateItem.upsert({
      where: { itemKey },
      update: { label, appliesTo, sequenceOrder: order },
      create: { itemKey, label, appliesTo, sequenceOrder: order },
    });
    order++;
  }

  // ── Aktivite şablonları (madde 35) ───────────────────
  // 3. eleman: requiresPileAcceptance — kazık kabulünü ön koşul yapan adım (madde 9).
  // "Tüm kazıklar kabul edildi" tek başına pier'i hazır YAPMAZ; yalnızca kazı adımını serbest bırakır.
  const templates: [ElementType, string, [string, string, boolean?][]][] = [
    ["PILE_CAP", "Pile Cap Standart İş Akışı", [
      ["EXCAVATION", "Kazı", true], // kazık kabulü olmadan pile cap kazısı başlamaz
      ["BLINDING", "Grobeton"],
      ["REBAR", "Donatı"],
      ["FORMWORK", "Kalıp"],
      ["EMBEDDED", "Gömülü Elemanlar"],
      ["SURVEY", "Survey"],
      ["CONCRETE", "Beton"],
      ["CURING", "Kür"],
    ]],
    ["PIER_GOVDESI", "Pier Gövdesi Standart İş Akışı", [
      ["REBAR", "Donatı"],
      ["FORMWORK", "Kalıp"],
      ["EMBEDDED", "Gömülü Elemanlar"],
      ["SURVEY", "Survey"],
      ["CONCRETE", "Beton"],
      ["CURING", "Kür"],
    ]],
    ["BASLIK", "Başlık Standart İş Akışı", [
      ["REBAR", "Donatı"],
      ["FORMWORK", "Kalıp"],
      ["SURVEY", "Survey"],
      ["CONCRETE", "Beton"],
      ["CURING", "Kür"],
    ]],
  ];
  for (const [elementType, name, steps] of templates) {
    const tpl = await prisma.activityTemplate.upsert({
      where: { elementType },
      update: { name },
      create: { elementType, name },
    });
    let seq = 1;
    for (const [activityType, stepName, requiresPiles] of steps) {
      await prisma.activityTemplateStep.upsert({
        where: { templateId_sequenceOrder: { templateId: tpl.id, sequenceOrder: seq } },
        update: { activityType, name: stepName, requiresPileAcceptance: !!requiresPiles },
        create: {
          templateId: tpl.id,
          activityType,
          name: stepName,
          sequenceOrder: seq,
          requiresPileAcceptance: !!requiresPiles,
        },
      });
      seq++;
    }
  }

  // ── ITP şablonu — Pile Cap (madde 24) ────────────────
  const itpTpl = await prisma.iTPTemplate.upsert({
    where: { elementType: "PILE_CAP" },
    update: {},
    create: { elementType: "PILE_CAP", name: "Pile Cap ITP" },
  });
  const itpPoints: [string, CheckpointType][] = [
    ["Kazı Kontrolü", "INSPECTION"],
    ["Grobeton Kontrolü", "INSPECTION"],
    ["Donatı Kontrolü", "HOLD_POINT"],
    ["Kalıp Kontrolü", "WITNESS_POINT"],
    ["Gömülü Eleman Kontrolü", "INSPECTION"],
    ["Survey Kontrolü", "HOLD_POINT"],
    ["Beton Dökümü", "HOLD_POINT"],
    ["Kür Kontrolü", "REVIEW"],
  ];
  let iseq = 1;
  for (const [name, checkpointType] of itpPoints) {
    await prisma.iTPCheckpoint.upsert({
      where: { templateId_sequenceOrder: { templateId: itpTpl.id, sequenceOrder: iseq } },
      update: { name, checkpointType },
      create: { templateId: itpTpl.id, name, checkpointType, sequenceOrder: iseq },
    });
    iseq++;
  }

  // ── Kaynaklar ────────────────────────────────────────
  // capacityM3PerHour: pompa süresi hesabı için (madde 10)
  // isPhysicallyExclusive: aynı anda tek yerde olabilen kaynak → kritik çakışma (madde 4)
  const resources: [string, string, string, number | null, boolean][] = [
    ["POMPA", "P-01", "Beton Pompası P-01", 60, true],
    ["POMPA", "P-02", "Beton Pompası P-02", 45, true],
    ["BETON_EKIBI", "BE-A", "Beton Ekibi A", null, true],
    ["BETON_EKIBI", "BE-B", "Beton Ekibi B", null, true],
    ["DONATI_EKIBI", "DE-A", "Donatı Ekibi A", null, true],
    ["KALIP_EKIBI", "KE-A", "Kalıp Ekibi A", null, true],
    ["SURVEY_EKIBI", "SE-A", "Survey Ekibi A", null, false], // bölünebilir: iki noktada ölçüm yapabilir
    ["QAQC_EKIBI", "QE-A", "QA/QC Ekibi A", null, false],
    ["VINC", "V-01", "Kule Vinç V-01", null, true],
  ];
  for (const [type, code, name, capacity, exclusive] of resources) {
    await prisma.resource.upsert({
      where: { code },
      update: { capacityM3PerHour: capacity, isPhysicallyExclusive: exclusive },
      create: {
        type: type as never,
        code,
        name,
        capacityM3PerHour: capacity,
        isPhysicallyExclusive: exclusive,
      },
    });
  }

  // ── Dengeli konsol kapı kuralı (madde 5) ─────────────
  // ÖRNEK VERİ: gerçek kural projenin onaylı Method Statement'ından girilmelidir.
  // Sistem bu kaydı bulamazsa kapı kararı ÜRETMEZ ("Tanımlanmamış" der).
  const existingRule = await prisma.segmentGateRule.findFirst({ where: { structureId: null } });
  if (!existingRule) {
    await prisma.segmentGateRule.create({
      data: {
        structureId: null,
        requiredSteps: [
          "rebarStatus",
          "formworkStatus",
          "tendonStatus",
          "anchorageStatus",
          "embeddedItemsStatus",
          "inspectionStatus",
          "concreteStatus",
          "postTensioningStatus",
          "surveyStatus",
        ],
        requireStrength: true,
        asymmetryThreshold: 2,
        note: "Varsayılan kural — proje Method Statement'ı ile doğrulanmalıdır",
      },
    });
  }

  // ── GERÇEK YAPI KAYITLARI: VIA-1 … VIA-48 ────────────
  // Kullanıcı talebiyle: yapılar boş iskelet olarak oluşturulur, pier detayı
  // (hangi yapıda kaç pier olduğu vb.) sistemde UYDURULMAZ (madde 49) —
  // her yapı elemanı kullanıcı tarafından /yapilar/[kod] sayfasındaki
  // "Eleman Ekle" formuyla ihtiyaç oldukça manuel eklenir.
  // Proje bilgisi (isim/ülke/müşteri) onaylı PTE dokümanından teyitli gerçek veridir.
  const realProject = await prisma.project.upsert({
    where: { code: "SP-S2" },
    update: {},
    create: {
      code: "SP-S2",
      name: "Sibiu–Pitești Otoyolu, Bölüm 2: Boița–Cornetu",
      country: "Romanya",
      client: "CNAIR",
      isSample: false,
    },
  });

  for (let n = 1; n <= 48; n++) {
    const code = `VIA-${n}`;
    await prisma.structure.upsert({
      where: { code },
      update: {},
      create: {
        projectId: realProject.id,
        code,
        name: `Viyadük ${n}`,
        type: "VIYADUK",
        isSample: false,
      },
    });
  }

  console.log("Seed tamamlandı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
