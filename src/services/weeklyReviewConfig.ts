export interface WeeklyReviewConfig {
  customPromptGuidance: string;
  defaultThemeHints: string[];
  officialEmailList: string[];
  reviewSpanDays: number;
  reviewStartDayOfWeek: number;
}

export const DEFAULT_WEEKLY_REVIEW_CONFIG: WeeklyReviewConfig = {
  customPromptGuidance: 'Surface only high-leverage executive actions and group emails into crisp business themes.',
  defaultThemeHints: [
    'Executive Decisions',
    'Delivery & Launches',
    'Customer & Partner Updates',
    'Finance & Compliance',
  ],
  officialEmailList: [],
  reviewSpanDays: 7,
  reviewStartDayOfWeek: 6,
};

const REVIEW_CONFIG_KEY = 'weekly_review_config_v1';

function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function normalizeWeeklyReviewConfig(value: unknown): WeeklyReviewConfig {
  if (!value || typeof value !== 'object') {
    return DEFAULT_WEEKLY_REVIEW_CONFIG;
  }

  const record = value as Record<string, unknown>;

  return {
    customPromptGuidance:
      typeof record.customPromptGuidance === 'string'
        ? record.customPromptGuidance.trim()
        : DEFAULT_WEEKLY_REVIEW_CONFIG.customPromptGuidance,
    defaultThemeHints: normalizeStringList(record.defaultThemeHints).slice(0, 6),
    officialEmailList: normalizeStringList(record.officialEmailList),
    reviewSpanDays:
      typeof record.reviewSpanDays === 'number' && Number.isFinite(record.reviewSpanDays)
        ? Math.min(14, Math.max(5, Math.round(record.reviewSpanDays)))
        : DEFAULT_WEEKLY_REVIEW_CONFIG.reviewSpanDays,
    reviewStartDayOfWeek:
      typeof record.reviewStartDayOfWeek === 'number' && Number.isFinite(record.reviewStartDayOfWeek)
        ? ((Math.round(record.reviewStartDayOfWeek) % 7) + 7) % 7
        : DEFAULT_WEEKLY_REVIEW_CONFIG.reviewStartDayOfWeek,
  };
}

export function loadWeeklyReviewConfig(): WeeklyReviewConfig {
  try {
    const raw = localStorage.getItem(REVIEW_CONFIG_KEY);
    if (!raw) {
      return DEFAULT_WEEKLY_REVIEW_CONFIG;
    }

    return normalizeWeeklyReviewConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_WEEKLY_REVIEW_CONFIG;
  }
}

export function saveWeeklyReviewConfig(config: WeeklyReviewConfig): void {
  localStorage.setItem(REVIEW_CONFIG_KEY, JSON.stringify(normalizeWeeklyReviewConfig(config)));
}

export function getWeeklyReviewConfigKey(config: WeeklyReviewConfig): string {
  const normalized = normalizeWeeklyReviewConfig(config);
  return JSON.stringify({
    customPromptGuidance: normalized.customPromptGuidance,
    defaultThemeHints: normalized.defaultThemeHints,
    officialEmailList: normalized.officialEmailList,
    reviewSpanDays: normalized.reviewSpanDays,
    reviewStartDayOfWeek: normalized.reviewStartDayOfWeek,
  });
}
