// Bloke işler (madde 11): neden + sorumlu + ne yapılırsa hazır olur.
// Blokaj ve uyarı ayrı gösterilir (madde 7 — NCR etkisi bazında).
//
// Katmanlama: blokaj sebepleri sistemin ürettiği metindir, değiştirilemez.
// Kullanıcı her işin altına not bırakabilir ("müteahhitle görüşüldü, çarşamba").
import { getBlockedActivities } from "@/lib/services/blocking";
import { requireSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getNotesFor, getSectionNotes } from "@/lib/services/notes";
import { noteKey } from "@/lib/sections";
import { Card, EmptyState, PageTitle, Badge } from "@/components/ui";
import { SectionCard } from "@/components/section-card";
import { NoteStrip } from "@/components/notes/note-strip";
import { BLOCKING_LEVEL_LABELS } from "@/lib/logic/blocking";

export const dynamic = "force-dynamic";

export default async function BlokePage() {
  const session = await requireSession();
  const viewer = { id: session.user.id, role: session.user.role };

  const [all, canWriteNote] = await Promise.all([
    getBlockedActivities(),
    hasPermission(session.user.role, "note", "create"),
  ]);
  const blocked = all.filter((b) => !b.canStart);
  const warnings = all.filter((b) => b.canStart);

  // Tüm işlerin notları TEK sorguda.
  const [activityNotes, sectionNotes] = await Promise.all([
    getNotesFor(
      all.map((b) => ({ entityType: "Activity", entityId: b.activity.id })),
      viewer
    ),
    getSectionNotes(["bloke.uyari"], viewer),
  ]);

  return (
    <div className="space-y-4">
      <PageTitle>Bloke İşler</PageTitle>

      {blocked.length === 0 ? (
        <Card>
          <EmptyState message="Bloke iş yok." />
        </Card>
      ) : (
        blocked.map(({ activity, reasons, nextActions, summary }) => (
          <Card key={activity.id}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold text-sm">
                  {activity.element.structure.code} {activity.element.name} — {activity.name}
                </p>
                <p className="text-xs text-gray-500">
                  Planlanan: {activity.plannedStart?.toLocaleDateString("tr-TR") ?? "Belirtilmemiş"}{" "}
                  → {activity.plannedEnd?.toLocaleDateString("tr-TR") ?? "Belirtilmemiş"}
                  {activity.responsibleUser ? ` · Sorumlu: ${activity.responsibleUser.name}` : ""}
                  {activity.crewResource ? ` · Ekip: ${activity.crewResource.name}` : ""}
                </p>
                <p className="text-xs text-gray-700 mt-1">{summary}</p>
              </div>
              <Badge tone="red">Bloke</Badge>
            </div>

            <div className="mt-3 space-y-2">
              {reasons.map((r, i) => (
                <div
                  key={i}
                  className={`rounded px-3 py-2 text-sm border ${
                    r.level === "BLOKAJ"
                      ? "bg-red-50 border-red-200"
                      : "bg-amber-50 border-amber-200"
                  }`}
                >
                  <p
                    className={`font-medium ${
                      r.level === "BLOKAJ" ? "text-red-900" : "text-amber-900"
                    }`}
                  >
                    [{BLOCKING_LEVEL_LABELS[r.level]}] {r.message}
                  </p>
                  <p className="text-xs text-gray-700 mt-1">
                    Sorumlu: <span className="font-medium">{r.responsible}</span> · Sonraki işlem:{" "}
                    {r.nextAction}
                  </p>
                </div>
              ))}
            </div>

            {nextActions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-600 mb-1">
                  Ne yapılırsa hazır olur:
                </p>
                <ol className="text-sm text-blue-900 list-decimal ml-5 space-y-0.5">
                  {nextActions.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ol>
              </div>
            )}

            <NoteStrip
              notes={activityNotes.get(noteKey("Activity", activity.id)) ?? []}
              entityType="Activity"
              entityId={activity.id}
              canWrite={canWriteNote}
            />
          </Card>
        ))
      )}

      {warnings.length > 0 && (
        <SectionCard
          sectionKey="bloke.uyari"
          title="Uyarılı İşler (başlanabilir, ancak dikkat gerekiyor)"
          notes={sectionNotes.get("Section:bloke.uyari") ?? []}
          canWriteNote={canWriteNote}
        >
          <ul className="space-y-2">
            {warnings.map(({ activity, reasons }) => (
              <li key={activity.id} className="border-l-4 border-amber-400 pl-3 py-1">
                <p className="text-sm font-medium">
                  {activity.element.structure.code} {activity.element.name} — {activity.name}
                </p>
                {reasons.map((r, i) => (
                  <p key={i} className="text-xs text-gray-600">
                    [{BLOCKING_LEVEL_LABELS[r.level]}] {r.message} → {r.nextAction}
                  </p>
                ))}
                <NoteStrip
                  notes={activityNotes.get(noteKey("Activity", activity.id)) ?? []}
                  entityType="Activity"
                  entityId={activity.id}
                  canWrite={canWriteNote}
                  compact
                />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
