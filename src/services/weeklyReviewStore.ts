import { ExtractedAction, WeeklyReviewData } from './weeklyReviewService';

export type PersistedReviewStep = 'digest' | 'actions' | 'followup' | 'complete';
export type PersistedActionViewMode = 'urgency' | 'theme';
export type PersistedActionStatus = 'pending' | 'resolved' | 'carry-forward' | 'snoozed' | 'dismissed';
export type ReviewActionArtifactType = 'reply' | 'delegate' | 'schedule' | 'task';

export interface ReviewActionArtifact {
  createdAt: string;
  detail: string;
  recipient?: string;
  scheduledFor?: string;
  subject?: string;
  title: string;
  type: ReviewActionArtifactType;
}

export interface CarryForwardEmailSnapshot {
  date: string;
  sender: string;
  snippet: string;
  subject: string;
}

export interface CarryForwardItem extends Omit<ExtractedAction, 'status'> {
  carriedAt: string;
  email: CarryForwardEmailSnapshot;
  snoozeDate?: string;
  sourcePeriodKey: string;
  status: 'carry-forward' | 'snoozed';
}

export interface PersistedReviewAction extends Omit<ExtractedAction, 'status'> {
  carriedIn?: boolean;
  completionArtifact?: ReviewActionArtifact;
  hasNewActivity?: boolean;
  snoozeDate?: string;
  status: PersistedActionStatus;
}

export interface PersistedReviewSession {
  actionViewMode: PersistedActionViewMode;
  actions: PersistedReviewAction[];
  data: WeeklyReviewData;
  expandedActions: string[];
  expandedThemes: string[];
  referenceNowKey: string;
  reviewContextKey: string;
  reviewPeriodKey: string;
  savedAt: string;
  step: PersistedReviewStep;
  version: 5;
}

export interface CompletedReviewActionDecision {
  artifact?: ReviewActionArtifact;
  status: PersistedActionStatus;
  threadId: string;
}

export interface CompletedReviewRecord {
  actionDecisions: CompletedReviewActionDecision[];
  carryForwardCount: number;
  completedAt: string;
  reviewContextKey: string;
  reviewPeriodKey: string;
  reviewPeriodLabel: string;
  summary: {
    carried: number;
    dismissed: number;
    resolved: number;
    snoozed: number;
  };
}

const CARRY_FORWARD_KEY = 'weekly_review_carry_forward_v2';
const COMPLETED_REVIEW_KEY = 'weekly_review_completed_review_v2';
const SESSION_PREFIX = 'weekly_review_session_v2';

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object';

function getSessionKey(reviewPeriodKey: string): string {
  return `${SESSION_PREFIX}:${reviewPeriodKey}`;
}

function isActionStatus(value: unknown): value is PersistedActionStatus {
  return value === 'pending' || value === 'resolved' || value === 'carry-forward' || value === 'snoozed' || value === 'dismissed';
}

function isReviewStep(value: unknown): value is PersistedReviewStep {
  return value === 'digest' || value === 'actions' || value === 'followup' || value === 'complete';
}

function isActionViewMode(value: unknown): value is PersistedActionViewMode {
  return value === 'urgency' || value === 'theme';
}

function isUrgency(value: unknown): value is ExtractedAction['urgency'] {
  return value === 'Critical' || value === 'High' || value === 'Medium' || value === 'Low';
}

function isArtifactType(value: unknown): value is ReviewActionArtifactType {
  return value === 'reply' || value === 'delegate' || value === 'schedule' || value === 'task';
}

function normalizeReviewActionArtifact(value: unknown): ReviewActionArtifact | undefined {
  if (!isRecord(value) || !isArtifactType(value.type) || typeof value.title !== 'string' || typeof value.detail !== 'string' || typeof value.createdAt !== 'string') {
    return undefined;
  }

  return {
    type: value.type,
    title: value.title,
    detail: value.detail,
    createdAt: value.createdAt,
    recipient: typeof value.recipient === 'string' ? value.recipient : undefined,
    scheduledFor: typeof value.scheduledFor === 'string' ? value.scheduledFor : undefined,
    subject: typeof value.subject === 'string' ? value.subject : undefined,
  };
}

function normalizePersistedAction(value: unknown): PersistedReviewAction | null {
  if (!isRecord(value) || typeof value.threadId !== 'string' || typeof value.summary !== 'string' || !isUrgency(value.urgency)) {
    return null;
  }

  const confidence = Number(value.confidence);
  if (!Number.isFinite(confidence) || !isActionStatus(value.status)) {
    return null;
  }

  return {
    threadId: value.threadId,
    summary: value.summary,
    urgency: value.urgency,
    confidence,
    status: value.status,
    dueDate: typeof value.dueDate === 'string' ? value.dueDate : undefined,
    snoozeDate: typeof value.snoozeDate === 'string' ? value.snoozeDate : undefined,
    carriedIn: typeof value.carriedIn === 'boolean' ? value.carriedIn : undefined,
    completionArtifact: normalizeReviewActionArtifact(value.completionArtifact),
  };
}

function normalizeCarryForwardItem(value: unknown): CarryForwardItem | null {
  if (!isRecord(value) || typeof value.threadId !== 'string' || typeof value.summary !== 'string' || !isUrgency(value.urgency)) {
    return null;
  }

  if (value.status !== 'carry-forward' && value.status !== 'snoozed') {
    return null;
  }

  const confidence = Number(value.confidence);
  if (!Number.isFinite(confidence) || typeof value.carriedAt !== 'string' || typeof value.sourcePeriodKey !== 'string' || !isRecord(value.email)) {
    return null;
  }

  if (typeof value.email.subject !== 'string' || typeof value.email.sender !== 'string' || typeof value.email.snippet !== 'string' || typeof value.email.date !== 'string') {
    return null;
  }

  return {
    threadId: value.threadId,
    summary: value.summary,
    urgency: value.urgency,
    confidence,
    status: value.status,
    sourcePeriodKey: value.sourcePeriodKey,
    carriedAt: value.carriedAt,
    dueDate: typeof value.dueDate === 'string' ? value.dueDate : undefined,
    snoozeDate: typeof value.snoozeDate === 'string' ? value.snoozeDate : undefined,
    email: {
      subject: value.email.subject,
      sender: value.email.sender,
      snippet: value.email.snippet,
      date: value.email.date,
    },
  };
}

export function loadCarryForwardItems(): CarryForwardItem[] {
  try {
    const raw = localStorage.getItem(CARRY_FORWARD_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeCarryForwardItem)
      .filter((item): item is CarryForwardItem => Boolean(item));
  } catch {
    return [];
  }
}

export function saveCarryForwardItems(items: CarryForwardItem[]): void {
  localStorage.setItem(CARRY_FORWARD_KEY, JSON.stringify(items));
  localStorage.removeItem('weekly_review_carry_forward');
}

export function loadReviewSession(reviewPeriodKey: string, reviewContextKey: string, referenceNowKey: string): PersistedReviewSession | null {
  try {
    const raw = localStorage.getItem(getSessionKey(reviewPeriodKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      parsed.version !== 5 ||
      parsed.reviewPeriodKey !== reviewPeriodKey ||
      parsed.reviewContextKey !== reviewContextKey ||
      parsed.referenceNowKey !== referenceNowKey ||
      !isReviewStep(parsed.step) ||
      !isActionViewMode(parsed.actionViewMode)
    ) {
      return null;
    }

    if (!Array.isArray(parsed.actions) || !Array.isArray(parsed.expandedThemes) || !Array.isArray(parsed.expandedActions) || !isRecord(parsed.data)) {
      return null;
    }

    const actions = parsed.actions
      .map(normalizePersistedAction)
      .filter((action): action is PersistedReviewAction => Boolean(action));

    if (actions.length !== parsed.actions.length) {
      return null;
    }

    return {
      version: 5,
      reviewPeriodKey,
      reviewContextKey,
      referenceNowKey,
      step: parsed.step,
      actionViewMode: parsed.actionViewMode,
      actions,
      data: parsed.data as unknown as WeeklyReviewData,
      expandedThemes: parsed.expandedThemes.filter((value): value is string => typeof value === 'string'),
      expandedActions: parsed.expandedActions.filter((value): value is string => typeof value === 'string'),
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveReviewSession(
  reviewPeriodKey: string,
  reviewContextKey: string,
  referenceNowKey: string,
  session: Omit<PersistedReviewSession, 'reviewPeriodKey' | 'reviewContextKey' | 'referenceNowKey' | 'savedAt' | 'version'>,
): void {
  const payload: PersistedReviewSession = {
    version: 5,
    reviewPeriodKey,
    reviewContextKey,
    referenceNowKey,
    savedAt: new Date().toISOString(),
    ...session,
  };

  localStorage.setItem(getSessionKey(reviewPeriodKey), JSON.stringify(payload));
}

export function clearReviewSession(reviewPeriodKey: string): void {
  localStorage.removeItem(getSessionKey(reviewPeriodKey));
}

export function saveCompletedReview(record: CompletedReviewRecord): void {
  localStorage.setItem(COMPLETED_REVIEW_KEY, JSON.stringify(record));
}

export function loadCompletedReview(): CompletedReviewRecord | null {
  try {
    const raw = localStorage.getItem(COMPLETED_REVIEW_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      typeof parsed.reviewPeriodKey !== 'string' ||
      typeof parsed.reviewContextKey !== 'string' ||
      typeof parsed.reviewPeriodLabel !== 'string' ||
      typeof parsed.completedAt !== 'string' ||
      !isRecord(parsed.summary) ||
      !Array.isArray(parsed.actionDecisions)
    ) {
      return null;
    }

    const actionDecisions = parsed.actionDecisions
      .map((value): CompletedReviewActionDecision | null => {
        if (!isRecord(value) || typeof value.threadId !== 'string' || !isActionStatus(value.status)) {
          return null;
        }

        return {
          threadId: value.threadId,
          status: value.status,
          artifact: normalizeReviewActionArtifact(value.artifact),
        };
      })
      .filter((item): item is CompletedReviewActionDecision => Boolean(item));

    return {
      reviewPeriodKey: parsed.reviewPeriodKey,
      reviewContextKey: parsed.reviewContextKey,
      reviewPeriodLabel: parsed.reviewPeriodLabel,
      completedAt: parsed.completedAt,
      actionDecisions,
      carryForwardCount: Number.isFinite(Number(parsed.carryForwardCount)) ? Number(parsed.carryForwardCount) : 0,
      summary: {
        resolved: Number.isFinite(Number(parsed.summary.resolved)) ? Number(parsed.summary.resolved) : 0,
        carried: Number.isFinite(Number(parsed.summary.carried)) ? Number(parsed.summary.carried) : 0,
        snoozed: Number.isFinite(Number(parsed.summary.snoozed)) ? Number(parsed.summary.snoozed) : 0,
        dismissed: Number.isFinite(Number(parsed.summary.dismissed)) ? Number(parsed.summary.dismissed) : 0,
      },
    };
  } catch {
    return null;
  }
}
