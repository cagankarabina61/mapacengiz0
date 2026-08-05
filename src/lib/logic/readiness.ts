// Beton döküm hazırlık kapısı (tasarım §5) — saf fonksiyonlar, DB'siz test edilebilir.

export interface ChecklistItemState {
  itemKey: string;
  label: string;
  isChecked: boolean;
}

export interface PourReadinessInput {
  checklistItems: ChecklistItemState[];
  isOverride: boolean;
  overrideReason?: string | null;
}

export interface PourReadinessResult {
  isReady: boolean;
  viaOverride: boolean;
  missingItems: ChecklistItemState[];
}

/** Tüm checklist maddeleri tamamlanmadan pour "Hazır" olamaz; override ayrıca işaretlenir. */
export function evaluatePourReadiness(input: PourReadinessInput): PourReadinessResult {
  const missingItems = input.checklistItems.filter((i) => !i.isChecked);
  if (missingItems.length === 0) {
    return { isReady: true, viaOverride: false, missingItems: [] };
  }
  if (input.isOverride && input.overrideReason?.trim()) {
    return { isReady: true, viaOverride: true, missingItems };
  }
  return { isReady: false, viaOverride: false, missingItems };
}
