import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Loader2,
  AlertCircle,
  MessageSquare,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Calendar,
  Reply,
  Forward,
  ListTodo,
  PartyPopper,
  Send,
  CalendarCheck,
  AlertTriangle,
  Gauge,
  Layers,
  MailOpen,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ActionDraftMode, extractWeeklyReviewData, ExtractedAction, generateActionDraft, GeneratedActionDraft, WeeklyReviewData } from '../services/weeklyReviewService';
import { MockEmail } from '../services/mockData';
import {
  CarryForwardItem,
  clearReviewSession,
  CompletedReviewRecord,
  loadReviewSessionForContext,
  loadReviewSession,
  PersistedActionStatus,
  ReviewActionArtifact,
  PersistedReviewAction,
  PersistedReviewStep,
  saveReviewSession,
} from '../services/weeklyReviewStore';
import { WeeklyReviewConfig } from '../services/weeklyReviewConfig';
import { PersistedThreadActionRecord } from '../services/reviewActivityDb';

interface WeeklyReviewProps {
  actionHistoryRecords?: PersistedThreadActionRecord[];
  allEmails: MockEmail[];
  completedReviewRecord?: CompletedReviewRecord | null;
  emails: MockEmail[];
  initialCarryForwardItems?: CarryForwardItem[];
  key?: string;
  referenceNow: string;
  referenceNowKey: string;
  reviewConfig: WeeklyReviewConfig;
  reviewContextKey: string;
  reviewPeriodLabel: string;
  reviewPeriodKey: string;
  preloadedData?: WeeklyReviewData | null;
  onOpenThread?: (threadId: string) => void;
  onPendingActionsChange?: (hasPendingActions: boolean) => void;
  onComplete: (result: ReviewCompletionResult) => void;
}

export interface ReviewCompletionResult {
  actionDecisions: Array<{
    artifact?: ReviewActionArtifact;
    status: ActionStatus;
    threadId: string;
  }>;
  carryForwardItems: CarryForwardItem[];
  completedAt: string;
  summary: {
    resolved: number;
    carried: number;
    snoozed: number;
    dismissed: number;
  };
}

type ReviewStep = PersistedReviewStep;
type ActionViewMode = 'urgency' | 'theme';
type ActionStatus = PersistedActionStatus;
type QuickResolveMode = 'reply' | 'delegate' | 'schedule' | 'task' | null;
type ReviewAction = PersistedReviewAction;

const urgencyColors = {
  Critical: 'bg-red-100 text-red-800 border-red-200',
  High: 'bg-orange-100 text-orange-800 border-orange-200',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Low: 'bg-green-100 text-green-800 border-green-200',
};

const urgencyLevels = ['Critical', 'High', 'Medium', 'Low'] as const;
const REVIEW_OWNER_REGEX = /rahul mehta|rahul/i;
type ActionUrgency = (typeof urgencyLevels)[number];

const tabButtonClass = 'cursor-pointer px-3 py-2 rounded-full border border-transparent text-sm font-medium transition-all hover:border-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1';
const actionButtonBaseClass = 'inline-flex h-9 cursor-pointer select-none items-center justify-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 active:translate-y-0 active:shadow-sm';
const quickActionButtonClass = `${actionButtonBaseClass} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const primaryActionClass = `${actionButtonBaseClass} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`;
const secondaryActionClass = `${actionButtonBaseClass} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const dangerActionClass = `${actionButtonBaseClass} border-red-200 bg-white text-red-600 hover:bg-red-50`;

const isActionUrgency = (value: string): value is ActionUrgency => urgencyLevels.includes(value as ActionUrgency);

const getActionStatusLabel = (status: ActionStatus): string | null => {
  if (status === 'resolved') return 'Completed';
  if (status === 'carry-forward') return 'Carried Forward';
  if (status === 'snoozed') return 'Snoozed';
  if (status === 'dismissed') return 'Dismissed';
  return null;
};

const formatDueDate = (dueDate?: string): string | null => {
  if (!dueDate) {
    return null;
  }

  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return format(parsed, 'MMM d');
};

const formatArtifactDateTime = (value?: string): string | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return format(parsed, 'MMM d, h:mm a');
};

const getDueDateMs = (dueDate?: string): number | null => {
  if (!dueDate) {
    return null;
  }

  const parsed = new Date(dueDate).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const getRiskState = (action: ReviewAction, referenceNowMs: number): 'overdue' | null => {
  if (action.status !== 'pending') {
    return null;
  }

  const dueMs = getDueDateMs(action.dueDate);
  if (dueMs !== null && dueMs < referenceNowMs) {
    return 'overdue';
  }

  return null;
};

const getLatestExternalActivityTimestampForEmail = (email: MockEmail): number => {
  const timestamps = [
    !REVIEW_OWNER_REGEX.test(email.sender) ? new Date(email.date).getTime() : Number.NEGATIVE_INFINITY,
    ...email.messages
      .filter((message) => !REVIEW_OWNER_REGEX.test(message.sender))
      .map((message) => new Date(message.date).getTime()),
  ].filter((value) => Number.isFinite(value));

  return timestamps.length > 0 ? Math.max(...timestamps) : 0;
};

const trackEvent = (eventName: string, payload: Record<string, unknown> = {}) => {
  console.log(`[Analytics Event] ${eventName}`, {
    timestamp: new Date().toISOString(),
    ...payload,
  });
};

const normalizeActionStatus = (status?: ExtractedAction['status']): ActionStatus => {
  if (status === 'Resolved') return 'resolved';
  if (status === 'CarryForward') return 'carry-forward';
  if (status === 'Snoozed') return 'snoozed';
  if (status === 'Dismissed') return 'dismissed';
  return 'pending';
};

export function WeeklyReview({
  actionHistoryRecords = [],
  allEmails,
  completedReviewRecord = null,
  emails,
  onComplete,
  initialCarryForwardItems = [],
  referenceNow,
  referenceNowKey,
  reviewConfig,
  reviewContextKey,
  reviewPeriodLabel,
  reviewPeriodKey,
  preloadedData = null,
  onOpenThread,
  onPendingActionsChange,
}: WeeklyReviewProps) {
  const [data, setData] = useState<WeeklyReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<ReviewStep>('digest');
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());
  const [actions, setActions] = useState<ReviewAction[]>([]);
  const [quickResolveActionId, setQuickResolveActionId] = useState<string | null>(null);
  const [quickResolveMode, setQuickResolveMode] = useState<QuickResolveMode>(null);
  const [quickNote, setQuickNote] = useState('');
  const [quickSubject, setQuickSubject] = useState('');
  const [quickRecipient, setQuickRecipient] = useState('');
  const [quickDateTime, setQuickDateTime] = useState('');
  const [quickResolveError, setQuickResolveError] = useState<string | null>(null);
  const [quickDraftStatus, setQuickDraftStatus] = useState<{ error: string | null; loading: boolean; source: string | null }>({
    error: null,
    loading: false,
    source: null,
  });
  const [quickDraftNonce, setQuickDraftNonce] = useState(0);
  const [saving, setSaving] = useState(false);
  const [actionViewMode, setActionViewMode] = useState<ActionViewMode>('urgency');

  const referenceNowMs = useMemo(() => {
    const parsed = new Date(referenceNow).getTime();
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }, [referenceNow]);

  const carryForwardByThreadId = useMemo(
    () => new Map(initialCarryForwardItems.map((item) => [item.threadId, item])),
    [initialCarryForwardItems],
  );
  const emailById = useMemo(() => new Map(allEmails.map((email) => [email.id, email])), [allEmails]);
  const actionHistoryByThreadId = useMemo(
    () => new Map(actionHistoryRecords.map((record) => [record.threadId, record])),
    [actionHistoryRecords],
  );
  const completedDecisionByThreadId = useMemo(
    () => new Map((completedReviewRecord?.actionDecisions ?? []).map((decision) => [decision.threadId, decision])),
    [completedReviewRecord],
  );

  const shouldSuppressResolvedThread = useCallback((threadId: string, isCarriedForward = false) => {
    // Never suppress carried-forward items – the user must explicitly resolve/dismiss them.
    if (isCarriedForward) {
      return false;
    }

    const email = emailById.get(threadId);
    const record = actionHistoryByThreadId.get(threadId);
    if (!email || !record || (record.status !== 'resolved' && record.status !== 'dismissed')) {
      return false;
    }

    return getLatestExternalActivityTimestampForEmail(email) <= record.latestExternalActivityTs;
  }, [actionHistoryByThreadId, emailById]);

  const applyHydratedReview = useCallback((result: WeeklyReviewData, persistedActionsByThreadId: Map<string, PersistedReviewAction> = new Map()) => {
    const hydratedActions = result.actions
      .filter((action) => !shouldSuppressResolvedThread(action.threadId, carryForwardByThreadId.has(action.threadId)))
      .map((action) => {
      const carryForwardItem = carryForwardByThreadId.get(action.threadId);
      const completedDecision = completedDecisionByThreadId.get(action.threadId);
      const persistedAction = persistedActionsByThreadId.get(action.threadId);
      const isCarriedIn = Boolean(carryForwardItem);
      // Detect fresh external activity since the item was carried forward.
      let hasNewActivity = false;
      if (isCarriedIn && carryForwardItem) {
        const email = emailById.get(action.threadId);
        if (email) {
          const carriedAtTs = new Date(carryForwardItem.carriedAt).getTime();
          const latestExtTs = getLatestExternalActivityTimestampForEmail(email);
          hasNewActivity = Number.isFinite(carriedAtTs) && latestExtTs > carriedAtTs;
        }
      }
      return {
        threadId: action.threadId,
        summary: action.summary,
        urgency: carryForwardItem && action.urgency === 'Low' ? carryForwardItem.urgency : action.urgency,
        dueDate: action.dueDate ?? carryForwardItem?.dueDate,
        confidence: action.confidence,
        status: persistedAction?.status ?? completedDecision?.status ?? normalizeActionStatus(action.status),
        snoozeDate: persistedAction?.snoozeDate ?? carryForwardItem?.snoozeDate,
        carriedIn: isCarriedIn,
        hasNewActivity,
        completionArtifact: persistedAction?.completionArtifact ?? completedDecision?.artifact,
      } as ReviewAction;
    });

    const existingThreadIds = new Set(hydratedActions.map((action) => action.threadId));
    for (const item of initialCarryForwardItems) {
      if (existingThreadIds.has(item.threadId) || shouldSuppressResolvedThread(item.threadId, true)) {
        continue;
      }

      const email = emailById.get(item.threadId);
      let hasNewActivity = false;
      if (email) {
        const carriedAtTs = new Date(item.carriedAt).getTime();
        const latestExtTs = getLatestExternalActivityTimestampForEmail(email);
        hasNewActivity = Number.isFinite(carriedAtTs) && latestExtTs > carriedAtTs;
      }

      hydratedActions.push({
        threadId: item.threadId,
        summary: item.summary,
        urgency: item.urgency,
        dueDate: item.dueDate,
        confidence: item.confidence,
        status: persistedActionsByThreadId.get(item.threadId)?.status ?? completedDecisionByThreadId.get(item.threadId)?.status ?? 'pending',
        snoozeDate: persistedActionsByThreadId.get(item.threadId)?.snoozeDate ?? item.snoozeDate,
        carriedIn: true,
        hasNewActivity,
        completionArtifact: persistedActionsByThreadId.get(item.threadId)?.completionArtifact ?? completedDecisionByThreadId.get(item.threadId)?.artifact,
      });
    }

    setData(result);
    setActions(hydratedActions);
    setStep('digest');
    setActionViewMode('urgency');
    setExpandedThemes(new Set());
    setExpandedActions(new Set());
  }, [carryForwardByThreadId, completedDecisionByThreadId, emailById, initialCarryForwardItems, shouldSuppressResolvedThread]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const exactSession = loadReviewSession(reviewPeriodKey, reviewContextKey, referenceNowKey);
      const contextSession = exactSession ?? loadReviewSessionForContext(reviewPeriodKey, reviewContextKey);
      const persistedActionsByThreadId = new Map((contextSession?.actions ?? []).map((action) => [action.threadId, action]));
      const result = preloadedData || await extractWeeklyReviewData(emails, { referenceNow, config: reviewConfig });
      applyHydratedReview(result, persistedActionsByThreadId);
      if (contextSession) {
        setStep(contextSession.step);
        setActionViewMode(contextSession.actionViewMode);
        setExpandedThemes(new Set(contextSession.expandedThemes));
        setExpandedActions(new Set(contextSession.expandedActions));
      }
      if (!preloadedData) {
        trackEvent('weekly_trigger_started');
      }
    } catch (e) {
      console.error(e);
      setError('Failed to generate weekly review. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [applyHydratedReview, emails, preloadedData, referenceNow, referenceNowKey, reviewConfig, reviewContextKey, reviewPeriodKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (loading || !data) {
      return;
    }

    saveReviewSession(reviewPeriodKey, reviewContextKey, referenceNowKey, {
      step,
      actionViewMode,
      actions,
      data,
      expandedThemes: Array.from(expandedThemes),
      expandedActions: Array.from(expandedActions),
    });
  }, [actionViewMode, actions, data, expandedActions, expandedThemes, loading, referenceNowKey, reviewContextKey, reviewPeriodKey, step]);

  useEffect(() => {
    if (step === 'digest' && data) {
      trackEvent('weekly_digest_viewed', { total_themes: data.themes.length });
    }
  }, [step, data]);

  useEffect(() => {
    if (step === 'followup') {
      setStep('actions');
    }
  }, [step]);



  const pendingActions = useMemo(() => actions.filter((a) => a.status === 'pending'), [actions]);
  const canShowReviewCompleted = Boolean(completedReviewRecord) && pendingActions.length === 0;
  const carriedInCount = useMemo(() => actions.filter((a) => a.carriedIn).length, [actions]);
  const unresolvedActions = useMemo(() => actions.filter((a) => a.status === 'pending' || a.status === 'carry-forward'), [actions]);
  const followThroughArtifacts = useMemo(
    () => actions
      .filter((action): action is ReviewAction & { completionArtifact: ReviewActionArtifact } => Boolean(action.completionArtifact))
      .sort((left, right) => (right.completionArtifact.createdAt || '').localeCompare(left.completionArtifact.createdAt || '')),
    [actions],
  );
  const followThroughCounts = useMemo(
    () => followThroughArtifacts.reduce(
      (acc, action) => {
        acc[action.completionArtifact.type] += 1;
        return acc;
      },
      { reply: 0, delegate: 0, schedule: 0, task: 0 },
    ),
    [followThroughArtifacts],
  );
  const sortedActions = useMemo(() => {
    const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return [...actions].sort((a, b) => {
      const aCarryPriority = a.carriedIn && a.status === 'pending' ? 0 : 1;
      const bCarryPriority = b.carriedIn && b.status === 'pending' ? 0 : 1;

      if (aCarryPriority !== bCarryPriority) {
        return aCarryPriority - bCarryPriority;
      }

      return order[a.urgency] - order[b.urgency];
    });
  }, [actions]);

  useEffect(() => {
    onPendingActionsChange?.(pendingActions.length > 0);
  }, [onPendingActionsChange, pendingActions.length]);

  const themeTitleByThreadId = useMemo(() => {
    const map = new Map<string, string>();
    if (!data) {
      return map;
    }

    data.themes.forEach((theme) => {
      theme.threadIds.forEach((threadId) => {
        if (!map.has(threadId)) {
          map.set(threadId, theme.title);
        }
      });
    });

    return map;
  }, [data]);

  const clusteredActions = useMemo(() => {
    const groups = new Map<string, ReviewAction[]>();
    sortedActions.forEach((action) => {
      const title = themeTitleByThreadId.get(action.threadId) || 'General Updates';
      const list = groups.get(title) ?? [];
      list.push(action);
      groups.set(title, list);
    });

    return Array.from(groups.entries()).map(([themeTitle, themeActions]) => ({
      themeTitle,
      themeActions,
      pendingCount: themeActions.filter((item) => item.status === 'pending').length,
    }));
  }, [sortedActions, themeTitleByThreadId]);

  const digestThemes = useMemo(() => {
    if (!data) {
      return [];
    }

    const seenTitles = new Map<string, number>();

    return data.themes
      .map((theme) => {
        const normalizedTitle = theme.title.trim().toLowerCase();
        const occurrence = (seenTitles.get(normalizedTitle) ?? 0) + 1;
        seenTitles.set(normalizedTitle, occurrence);
        const displayTitle = occurrence > 1 ? `${theme.title} (${occurrence})` : theme.title;

        const themeEmails = theme.threadIds
          .map((id) => emails.find((email) => email.id === id))
          .filter((email): email is MockEmail => Boolean(email));

        const unreadCount = themeEmails.filter((email) => email.unread).length;
        const themeActions = actions.filter((action) => theme.threadIds.includes(action.threadId));
        const pendingCount = themeActions.filter((action) => action.status === 'pending').length;
        const actionableCount = themeActions.length;
        const hasCriticalPending = themeActions.some(
          (action) => action.status === 'pending' && (action.urgency === 'Critical' || action.urgency === 'High')
        );
        const needsAction = theme.hasCriticalAction || hasCriticalPending || pendingCount > 0;

        const activityScore = themeEmails.length * 12 + unreadCount * 18 + pendingCount * 20;
        const activityLabel = activityScore >= 80 ? 'High activity' : activityScore >= 40 ? 'Medium activity' : 'Low activity';

        return {
          ...theme,
          displayTitle,
          unreadCount,
          pendingCount,
          needsAction,
          activityLabel,
          actionableCount,
          threadCount: theme.threadIds.length,
        };
      })
      .sort((a, b) => {
        if (a.needsAction !== b.needsAction) {
          return Number(b.needsAction) - Number(a.needsAction);
        }
        return b.threadCount - a.threadCount;
      });
  }, [actions, data, emails]);

  const hasReviewData = useMemo(() => digestThemes.length > 0 || sortedActions.length > 0, [digestThemes.length, sortedActions.length]);

  const summary = useMemo(
    () =>
      actions.reduce(
        (acc, action) => {
          if (action.status === 'resolved') acc.resolved += 1;
          if (action.status === 'carry-forward' || action.status === 'snoozed') acc.carried += 1;
          if (action.status === 'snoozed') acc.snoozed += 1;
          if (action.status === 'dismissed') acc.dismissed += 1;
          return acc;
        },
        { resolved: 0, carried: 0, snoozed: 0, dismissed: 0 }
      ),
    [actions]
  );

  const setActionStatus = (threadId: string, status: ActionStatus) => {
    setActions((prev) => prev.map((action) => {
      if (action.threadId !== threadId) {
        return action;
      }

      return {
        ...action,
        status,
        completionArtifact: status === 'resolved' ? action.completionArtifact : undefined,
      };
    }));

    if (status === 'resolved') trackEvent('action_item_resolved', { action_id: threadId });
    if (status === 'dismissed') trackEvent('action_item_dismissed', { action_id: threadId });
    if (status === 'carry-forward') trackEvent('carry_forward_selected', { action_id: threadId });
  };

  const setActionUrgency = (threadId: string, urgency: string) => {
    if (!isActionUrgency(urgency)) {
      return;
    }

    setActions((prev) =>
      prev.map((action) => {
        if (action.threadId === threadId) {
          trackEvent('urgency_overridden', {
            action_id: threadId,
            urgency_before: action.urgency,
            urgency_after: urgency,
          });
          return { ...action, urgency };
        }
        return action;
      })
    );
  };

  const resolveActionWithAnimation = (threadId: string, mode: QuickResolveMode, artifact?: ReviewActionArtifact) => {
    setActions((prev) => prev.map((action) => (
      action.threadId === threadId
        ? {
            ...action,
            status: 'resolved',
            snoozeDate: mode === 'schedule' ? (quickDateTime || action.snoozeDate) : action.snoozeDate,
            completionArtifact: artifact,
          }
        : action
    )));
    trackEvent('action_item_resolved', { action_id: threadId, resolve_mode: mode });
  };

  const toggleActionSource = (threadId: string) => {
    setExpandedActions((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else {
        next.add(threadId);
        trackEvent('action_item_opened', { action_id: threadId });
      }
      return next;
    });
  };

  const toggleTheme = (title: string) => {
    setExpandedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else {
        next.add(title);
        trackEvent('theme_card_expanded', { theme_title: title });
      }
      return next;
    });
  };

  const closeReview = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 450));
    const completedAt = new Date(referenceNowMs).toISOString();
    const carryForwardItems = actions
      .filter((action) => action.status === 'carry-forward' || action.status === 'snoozed')
      .map((action) => {
        const email = emailById.get(action.threadId);
        const existingCarryForward = carryForwardByThreadId.get(action.threadId);

        return {
          threadId: action.threadId,
          summary: action.summary,
          urgency: action.urgency,
          dueDate: action.dueDate,
          confidence: action.confidence,
          status: action.status === 'snoozed' ? 'snoozed' : 'carry-forward',
          snoozeDate: action.snoozeDate,
          carriedAt: completedAt,
          sourcePeriodKey: reviewPeriodKey,
          email: existingCarryForward?.email ?? {
            subject: email?.subject || action.summary,
            sender: email?.sender || 'Unknown sender',
            snippet: email?.snippet || action.summary,
            date: email?.date || completedAt,
          },
        } satisfies CarryForwardItem;
      });

    const result: ReviewCompletionResult = {
      actionDecisions: actions.map((action) => ({
        threadId: action.threadId,
        status: action.status,
        artifact: action.completionArtifact,
      })),
      carryForwardItems,
      completedAt,
      summary,
    };

    trackEvent('weekly_review_completed', {
      resolved_count: summary.resolved,
      carried_count: summary.carried,
    });

    clearReviewSession(reviewPeriodKey);
    setSaving(false);
    onComplete(result);
  };

  const buildLocalDraft = useCallback((action: ReviewAction, mode: ActionDraftMode): GeneratedActionDraft => {
    const email = emailById.get(action.threadId);
    const senderName = email?.sender.split(' ')[0] || 'there';

    if (mode === 'reply') {
      return {
        recipient: email?.sender || '',
        subject: `Re: ${email?.subject || 'Current email'}`,
        body: `Hi ${senderName},\n\nThanks for the update on ${email?.subject || 'this email'}. I will move forward on ${action.summary.toLowerCase()}.\n\nBest,\nRahul`,
        generatedBy: 'fallback',
      };
    }

    return {
      recipient: 'Chief of Staff',
      subject: `Please take point on: ${email?.subject || 'Current email'}`,
      body: `Please take ownership of this and send an update today: ${action.summary}.\n\nReference: ${email?.subject || 'Current email'}`,
      generatedBy: 'fallback',
    };
  }, [emailById]);

  const openQuickResolve = (action: ReviewAction, mode: Exclude<QuickResolveMode, null>) => {
    const email = emailById.get(action.threadId);
    const defaultDraft =
      mode === 'reply' || mode === 'delegate'
        ? buildLocalDraft(action, mode)
        : null;
    const defaultTaskDraft = `Follow through on: ${action.summary}`;

    setQuickResolveActionId(action.threadId);
    setQuickResolveMode(mode);
    setQuickNote(defaultDraft?.body || (mode === 'task' ? defaultTaskDraft : ''));
    setQuickSubject(defaultDraft?.subject || '');
    setQuickRecipient(defaultDraft?.recipient || (mode === 'delegate' ? 'Chief of Staff' : (email?.sender || '')));
    setQuickDateTime('');
    setQuickResolveError(null);
    setQuickDraftStatus({ error: null, loading: mode === 'reply' || mode === 'delegate', source: defaultDraft ? 'Template fallback' : null });
    if (mode === 'reply' || mode === 'delegate') {
      setQuickDraftNonce((prev) => prev + 1);
    }
  };

  const closeQuickResolve = () => {
    setQuickResolveActionId(null);
    setQuickResolveMode(null);
    setQuickNote('');
    setQuickSubject('');
    setQuickRecipient('');
    setQuickDateTime('');
    setQuickResolveError(null);
    setQuickDraftStatus({ error: null, loading: false, source: null });
  };

  const buildCompletionArtifact = (action: ReviewAction, mode: Exclude<QuickResolveMode, null>): ReviewActionArtifact | undefined => {
    const createdAt = new Date(referenceNowMs).toISOString();

    if (mode === 'reply') {
      return {
        type: 'reply',
        title: 'Reply draft prepared',
        detail: `Ready to send to ${quickRecipient || 'the sender'}.`,
        createdAt,
        recipient: quickRecipient || undefined,
        subject: quickSubject || undefined,
      };
    }

    if (mode === 'delegate') {
      return {
        type: 'delegate',
        title: 'Delegation draft prepared',
        detail: `Hand-off drafted for ${quickRecipient || 'your teammate'}.`,
        createdAt,
        recipient: quickRecipient || undefined,
        subject: quickSubject || undefined,
      };
    }

    if (mode === 'schedule') {
      return {
        type: 'schedule',
        title: 'Calendar reminder created',
        detail: `Follow-up set for ${formatArtifactDateTime(quickDateTime) || 'the selected time'}.`,
        createdAt,
        scheduledFor: quickDateTime || undefined,
      };
    }

    if (mode === 'task') {
      return {
        type: 'task',
        title: 'Task added',
        detail: quickNote.trim() || action.summary,
        createdAt,
      };
    }

    return undefined;
  };

  const submitQuickResolve = (action: ReviewAction) => {
    if (!quickResolveMode) {
      return;
    }

    if ((quickResolveMode === 'reply' || quickResolveMode === 'delegate') && (!quickRecipient.trim() || !quickNote.trim() || !quickSubject.trim())) {
      setQuickResolveError('Add recipient, subject, and message before confirming.');
      return;
    }

    if (quickResolveMode === 'schedule' && !quickDateTime) {
      setQuickResolveError('Choose a follow-up date and time before confirming.');
      return;
    }

    if (quickResolveMode === 'task' && !quickNote.trim()) {
      setQuickResolveError('Add a task title before confirming.');
      return;
    }

    resolveActionWithAnimation(action.threadId, quickResolveMode, buildCompletionArtifact(action, quickResolveMode));

    closeQuickResolve();
  };

  useEffect(() => {
    if (!quickResolveActionId || (quickResolveMode !== 'reply' && quickResolveMode !== 'delegate')) {
      return;
    }

    const action = actions.find((item) => item.threadId === quickResolveActionId);
    const email = emailById.get(quickResolveActionId);
    if (!action || !email) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setQuickDraftStatus((prev) => ({ ...prev, loading: true, error: null }));
        const draft = await generateActionDraft(email, action, quickResolveMode, {
          config: reviewConfig,
          referenceNow,
          recipientHint: quickResolveMode === 'delegate' ? quickRecipient || 'Chief of Staff' : email.sender,
        });

        if (cancelled) {
          return;
        }

        setQuickRecipient(draft.recipient || (quickResolveMode === 'reply' ? email.sender : 'Chief of Staff'));
        setQuickSubject(draft.subject);
        setQuickNote(draft.body);
        setQuickDraftStatus({
          loading: false,
          error: null,
          source: draft.generatedBy === 'groq' ? `Generated with ${draft.model || 'Groq'}` : 'Template fallback',
        });
      } catch (error) {
        console.error(error);
        if (cancelled) {
          return;
        }

        const fallbackDraft = buildLocalDraft(action, quickResolveMode);
        setQuickRecipient(fallbackDraft.recipient);
        setQuickSubject(fallbackDraft.subject);
        setQuickNote(fallbackDraft.body);
        setQuickDraftStatus({
          loading: false,
          error: 'Could not generate a model draft. Using a local template instead.',
          source: 'Template fallback',
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [actions, buildLocalDraft, emailById, quickDraftNonce, quickResolveActionId, quickResolveMode, referenceNow, reviewConfig]);

  const renderActionCard = (action: ReviewAction) => {
    const email = emailById.get(action.threadId);
    const carryForwardContext = carryForwardByThreadId.get(action.threadId);
    const resolved = action.status !== 'pending';
    const dueDateLabel = formatDueDate(action.dueDate);
    const riskState = getRiskState(action, referenceNowMs);
    const sourceSender = email?.sender || carryForwardContext?.email.sender;
    const sourceSubject = email?.subject || carryForwardContext?.email.subject;
    const sourceSnippet = email?.messages[email.messages.length - 1]?.body || email?.snippet || carryForwardContext?.email.snippet;
    const artifactDateLabel = formatArtifactDateTime(action.completionArtifact?.scheduledFor || action.completionArtifact?.createdAt);

    return (
      <div key={action.threadId} className={cn('p-4 transition-colors', resolved && 'opacity-60 bg-gray-50')}>
        <div className="flex items-start gap-3">
          <button onClick={() => setActionStatus(action.threadId, resolved ? 'pending' : 'resolved')} className={cn('h-5 w-5 border rounded mt-1', resolved ? 'bg-blue-500 border-blue-500' : 'border-gray-300')}>
            {resolved ? <CheckSquare className="h-4 w-4 text-white" /> : null}
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <select value={action.urgency} onChange={(e) => setActionUrgency(action.threadId, e.target.value)} className={cn('text-xs px-2 py-1 rounded-full border', urgencyColors[action.urgency])} disabled={resolved}>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              {riskState === 'overdue' && (
                <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">Overdue</span>
              )}
              {dueDateLabel && (
                <span className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="h-3 w-3" />Due: {dueDateLabel}</span>
              )}
              {action.carriedIn && (
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">Carried In</span>
              )}
              {(action as ReviewAction & { hasNewActivity?: boolean }).hasNewActivity && (
                <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">New reply since last review</span>
              )}
              {getActionStatusLabel(action.status) && (
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">{getActionStatusLabel(action.status)}</span>
              )}
              <span className="text-xs text-gray-400 ml-auto">AI Confidence: {action.confidence}%</span>
            </div>
            <p className={cn('text-sm font-medium', resolved && 'line-through text-gray-500')}>{action.summary}</p>
            {action.completionArtifact && (
              <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{action.completionArtifact.title}</span>
                  {artifactDateLabel && <span className="text-emerald-700">{artifactDateLabel}</span>}
                </div>
                <p className="mt-1 text-emerald-800">{action.completionArtifact.detail}</p>
              </div>
            )}
            {(sourceSender || sourceSubject) && (
              <div className="mt-1 text-xs text-gray-500">
                <span className="font-medium text-gray-700">{sourceSender}</span> • {sourceSubject}
                <button onClick={() => toggleActionSource(action.threadId)} className="ml-2 text-blue-600 hover:underline">{expandedActions.has(action.threadId) ? 'Hide Source' : 'View Source'}</button>
                {onOpenThread && (
                  <button onClick={() => onOpenThread(action.threadId)} className="ml-2 text-blue-600 hover:underline">Open Email</button>
                )}
              </div>
            )}
            {expandedActions.has(action.threadId) && sourceSnippet && (
              <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                {sourceSnippet}
              </div>
            )}
            {!resolved && (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => openQuickResolve(action, 'reply')} className={quickActionButtonClass}><Reply className="h-3.5 w-3.5" />Reply Inline</button>
                  <button onClick={() => openQuickResolve(action, 'delegate')} className={quickActionButtonClass}><Forward className="h-3.5 w-3.5" />Delegate</button>
                  <button onClick={() => openQuickResolve(action, 'schedule')} className={quickActionButtonClass}><Calendar className="h-3.5 w-3.5" />Schedule</button>
                  <button onClick={() => openQuickResolve(action, 'task')} className={quickActionButtonClass}><ListTodo className="h-3.5 w-3.5" />Add to Tasks</button>
                  <button onClick={() => setActionStatus(action.threadId, 'carry-forward')} className={secondaryActionClass}>Carry Forward</button>
                  <button onClick={() => setActionStatus(action.threadId, 'dismissed')} className={dangerActionClass}>Dismiss</button>
                </div>
              </>
            )}
            {quickResolveActionId === action.threadId && quickResolveMode && (
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                {(quickResolveMode === 'reply' || quickResolveMode === 'delegate') && (
                  <>
                    <div className="text-xs font-medium text-blue-900">{quickResolveMode === 'reply' ? 'Inline Reply' : 'Delegate Action'}</div>
                    <input
                      value={quickRecipient}
                      onChange={(e) => setQuickRecipient(e.target.value)}
                      className="w-full rounded-md border border-blue-200 bg-white px-2 py-1 text-xs text-gray-700"
                      placeholder="Recipient"
                    />
                    <input
                      value={quickSubject}
                      onChange={(e) => setQuickSubject(e.target.value)}
                      className="w-full rounded-md border border-blue-200 bg-white px-2 py-1 text-xs text-gray-700"
                      placeholder="Subject"
                    />
                    <textarea
                      value={quickNote}
                      onChange={(e) => setQuickNote(e.target.value)}
                      className="w-full rounded-md border border-blue-200 bg-white px-2 py-1 text-xs text-gray-700 resize-none"
                      rows={3}
                    />
                    {(sourceSubject || sourceSnippet) && (
                      <div className="rounded-md border border-blue-200 bg-white p-2">
                        <p className="text-[11px] font-medium text-gray-600">Email context</p>
                        <p className="mt-1 text-xs text-gray-700 font-medium">{sourceSubject}</p>
                        <p className="mt-1 text-xs text-gray-600 line-clamp-3">{sourceSnippet}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 text-[11px] text-blue-800">
                      <div className="flex items-center gap-2">
                        {quickDraftStatus.loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        <span>{quickDraftStatus.loading ? 'Generating draft...' : quickDraftStatus.source || 'Draft ready'}</span>
                      </div>
                      <button
                        onClick={() => setQuickDraftNonce((prev) => prev + 1)}
                        className="rounded-full border border-blue-200 bg-white px-2.5 py-1 font-medium text-blue-700 hover:bg-blue-100"
                        type="button"
                      >
                        Regenerate
                      </button>
                    </div>
                    {quickDraftStatus.error && (
                      <p className="text-[11px] text-amber-700">{quickDraftStatus.error}</p>
                    )}
                  </>
                )}
                {quickResolveMode === 'schedule' && (
                  <>
                    <div className="text-xs font-medium text-blue-900">Schedule Follow-up</div>
                    <input
                      type="datetime-local"
                      value={quickDateTime}
                      onChange={(e) => setQuickDateTime(e.target.value)}
                      className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs text-gray-700"
                    />
                    {(sourceSubject || sourceSnippet) && (
                      <div className="rounded-md border border-blue-200 bg-white p-2">
                        <p className="text-[11px] font-medium text-gray-600">Email context</p>
                        <p className="mt-1 text-xs text-gray-700 font-medium">{sourceSubject}</p>
                        <p className="mt-1 text-xs text-gray-600 line-clamp-3">{sourceSnippet}</p>
                      </div>
                    )}
                    <p className="text-[11px] text-blue-800">A calendar reminder will appear in this review summary after you confirm.</p>
                  </>
                )}
                {quickResolveMode === 'task' && (
                  <>
                    <div className="text-xs font-medium text-blue-900">Create Task</div>
                    <input
                      value={quickNote}
                      onChange={(e) => setQuickNote(e.target.value)}
                      className="w-full rounded-md border border-blue-200 bg-white px-2 py-1 text-xs text-gray-700"
                      placeholder="Task title"
                    />
                    {(sourceSubject || sourceSnippet) && (
                      <div className="rounded-md border border-blue-200 bg-white p-2">
                        <p className="text-[11px] font-medium text-gray-600">Email context</p>
                        <p className="mt-1 text-xs text-gray-700 font-medium">{sourceSubject}</p>
                        <p className="mt-1 text-xs text-gray-600 line-clamp-3">{sourceSnippet}</p>
                      </div>
                    )}
                    <p className="text-[11px] text-blue-800">This task will appear in the follow-through summary after you confirm.</p>
                  </>
                )}
                {quickResolveError && (
                  <p className="text-[11px] text-amber-700">{quickResolveError}</p>
                )}
                <div className="flex items-center gap-2">
                  <button onClick={() => submitQuickResolve(action)} className={primaryActionClass}>
                    {quickResolveMode === 'schedule' ? <CalendarCheck className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                    Confirm
                  </button>
                  <button onClick={closeQuickResolve} className={secondaryActionClass}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600">Analyzing your inbox...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <p className="text-gray-700 mb-6">{error || 'Could not load weekly review.'}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={fetchData}
              className={secondaryActionClass}
            >
              Retry Review
            </button>
            <button
              onClick={() =>
                onComplete({
                  actionDecisions: [],
                  carryForwardItems: initialCarryForwardItems,
                  completedAt: new Date(referenceNowMs).toISOString(),
                  summary: { resolved: 0, carried: initialCarryForwardItems.length, snoozed: 0, dismissed: 0 },
                })
              }
              className={primaryActionClass}
            >
              Open Chronological Inbox
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Weekly Review</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-500">{reviewPeriodLabel} - {emails.length} emails in scope</p>
              {canShowReviewCompleted && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  ✓ Review Completed
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setStep('digest')} className={cn(tabButtonClass, step === 'digest' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600')}>Digest</button>
            <button onClick={() => setStep('actions')} className={cn(tabButtonClass, step === 'actions' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600')}>Actions</button>
            {!hasReviewData && (
              <span className="ml-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                No data this week
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          {step === 'digest' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      <Gauge className="h-5 w-5 text-blue-600" />
                      Executive Snapshot
                    </h2>
                    <p className="text-sm text-slate-600 mt-1">One-page summary of this week's communication landscape.</p>
                  </div>
                  <button onClick={() => setStep('actions')} className={primaryActionClass}>
                    Go to Action Items
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <DigestStatCard icon={Layers} label="Themes" value={digestThemes.length} tone="slate" />
                  <DigestStatCard icon={MessageSquare} label="Emails" value={emails.length} tone="blue" />
                  <DigestStatCard icon={CheckSquare} label="Pending Actions" value={pendingActions.length} tone="amber" />
                  <DigestStatCard icon={MailOpen} label="Unread Emails" value={emails.filter((email) => email.unread).length} tone="red" />
                </div>
                <p className="mt-3 text-xs text-slate-600">
                  {unresolvedActions.length > 0
                    ? `${unresolvedActions.length} unresolved item${unresolvedActions.length > 1 ? 's' : ''} remain across the week${carriedInCount > 0 ? `, including ${carriedInCount} carried-in email${carriedInCount === 1 ? '' : 's'}` : ''}.`
                    : 'No unresolved items detected for this review period.'}
                </p>
              </div>
              {hasReviewData ? (
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-500" />
                  Themed Digest
                </h3>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {digestThemes.map((theme) => (
                      <div key={theme.displayTitle} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <button onClick={() => toggleTheme(theme.displayTitle)} className="w-full p-4 text-left hover:bg-gray-50 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-gray-900">{theme.displayTitle}</h4>
                            {theme.needsAction ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                                <AlertTriangle className="h-3 w-3" />
                                Action needed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700">
                                On track
                              </span>
                            )}
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700">{theme.activityLabel}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{theme.summary}</p>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
                              <p className="text-gray-500">Emails</p>
                              <p className="font-semibold text-gray-900">{theme.threadCount}</p>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
                              <p className="text-gray-500">Unread</p>
                              <p className="font-semibold text-gray-900">{theme.unreadCount}</p>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
                              <p className="text-gray-500">Actionable</p>
                              <p className="font-semibold text-gray-900">{theme.actionableCount}</p>
                            </div>
                          </div>
                        </div>
                        {expandedThemes.has(theme.displayTitle) ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                      </button>
                      {expandedThemes.has(theme.displayTitle) && (
                        <div className="border-t border-gray-100 bg-gray-50 p-4">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-3">
                            <span>{theme.unreadCount} unread email{theme.unreadCount === 1 ? '' : 's'}</span>
                            <span>{theme.pendingCount} pending action{theme.pendingCount === 1 ? '' : 's'}</span>
                          </div>
                          <div className="space-y-1.5">
                            {theme.threadIds.map((id) => {
                              const email = emails.find((e) => e.id === id);
                              if (!email) return null;
                              return (
                                <div key={id} className="text-sm text-gray-700">
                                  <span className="font-medium">{email.sender}:</span> {email.subject}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    ))}
                </div>
                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Follow-through created</h3>
                      <p className="mt-1 text-sm text-slate-600">Tasks, reminders, and drafted responses from this review appear here.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 font-medium text-green-700">{followThroughCounts.task} task{followThroughCounts.task === 1 ? '' : 's'}</span>
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-medium text-blue-700">{followThroughCounts.schedule} reminder{followThroughCounts.schedule === 1 ? '' : 's'}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium text-slate-700">{followThroughCounts.reply + followThroughCounts.delegate} draft{followThroughCounts.reply + followThroughCounts.delegate === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                  {followThroughArtifacts.length > 0 ? (
                    <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-2">
                      {followThroughArtifacts.map((action) => (
                        <div key={`${action.threadId}-${action.completionArtifact.createdAt}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">{action.completionArtifact.title}</p>
                            <span className="text-[11px] text-slate-500">{formatArtifactDateTime(action.completionArtifact.scheduledFor || action.completionArtifact.createdAt) || 'Saved'}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-700">{action.completionArtifact.detail}</p>
                          <p className="mt-2 text-[11px] text-slate-500">{emailById.get(action.threadId)?.subject || action.summary}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                      Schedule a follow-up or add a task from any action item and it will show up here.
                    </div>
                  )}
                </div>

                <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Review Completion</h3>
                      <p className="mt-1 text-xs text-gray-600">
                        {pendingActions.length > 0
                          ? `${pendingActions.length} unresolved item${pendingActions.length > 1 ? 's' : ''} still need a final decision in the actions workspace before completion.`
                          : 'All unresolved items are classified. You can complete this review now.'}
                      </p>
                    </div>
                    <button onClick={() => setStep('actions')} className={primaryActionClass}>
                      Open Actions Workspace
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <p className="text-gray-500">Pending</p>
                      <p className="font-semibold text-gray-900">{actions.filter((item) => item.status === 'pending').length}</p>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                      <p className="text-blue-700">Carry Forward (incl. snoozed)</p>
                      <p className="font-semibold text-blue-900">{actions.filter((item) => item.status === 'carry-forward' || item.status === 'snoozed').length}</p>
                    </div>
                    <div className="rounded-lg border border-gray-300 bg-gray-100 px-3 py-2">
                      <p className="text-gray-600">Dismissed</p>
                      <p className="font-semibold text-gray-900">{actions.filter((item) => item.status === 'dismissed').length}</p>
                    </div>
                  </div>
                </div>
              </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center">
                  <p className="text-sm font-medium text-gray-700">No data available for this review period.</p>
                  <p className="mt-1 text-xs text-gray-500">No emails or action items were detected in the selected week.</p>
                </div>
              )}
            </div>
          )}

          {step === 'actions' && (
            <div>
              <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-gray-400" />
                  Prioritized Actions ({pendingActions.length} pending)
                </h2>
                <div className="inline-flex rounded-full border border-gray-300 p-1">
                  <button onClick={() => setActionViewMode('urgency')} className={cn('px-3 py-1.5 rounded-full text-xs font-medium', actionViewMode === 'urgency' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100')}>
                    Sort by urgency
                  </button>
                  <button onClick={() => setActionViewMode('theme')} className={cn('px-3 py-1.5 rounded-full text-xs font-medium', actionViewMode === 'theme' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100')}>
                    View by theme
                  </button>
                </div>
              </div>

              {!hasReviewData ? (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center">
                  <p className="text-sm font-medium text-gray-700">No action data available.</p>
                  <p className="mt-1 text-xs text-gray-500">There are no action items to prioritize for this review window.</p>
                </div>
              ) : actionViewMode === 'urgency' ? (
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {sortedActions.map((action) => renderActionCard(action))}
                </div>
              ) : (
                <div className="space-y-4">
                  {clusteredActions.map((cluster) => (
                    <section key={cluster.themeTitle} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-800">{cluster.themeTitle}</h3>
                        <span className="text-xs text-gray-500">{cluster.pendingCount} pending</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {cluster.themeActions.map((action) => renderActionCard(action))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
              {hasReviewData && (
                <div className="mt-6 space-y-4">
                  {pendingActions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => pendingActions.forEach((action) => setActionStatus(action.threadId, 'carry-forward'))} className={secondaryActionClass}>
                        Carry Forward All Pending
                      </button>
                      <button onClick={() => pendingActions.forEach((action) => setActionStatus(action.threadId, 'dismissed'))} className={dangerActionClass}>
                        Dismiss All Pending
                      </button>
                    </div>
                  )}

                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">Complete Review</h3>
                        <p className="mt-1 text-xs text-gray-600">
                          {pendingActions.length > 0
                            ? `${pendingActions.length} pending item${pendingActions.length > 1 ? 's' : ''} still need a decision before you can finish this review.`
                            : 'All pending work is classified. You can complete this weekly review now.'}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setStep('complete');
                        }}
                        disabled={pendingActions.length > 0}
                        className={`${primaryActionClass} disabled:opacity-50`}
                      >
                        Complete Weekly Review
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'complete' && (
            <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <PartyPopper className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">Weekly Review Complete</h2>
              <p className="text-sm text-gray-500 mt-1">Closure summary for {reviewPeriodLabel}</p>
              <p className="mt-2 text-sm text-green-700 font-medium">
                Review Complete: {summary.resolved} task{summary.resolved === 1 ? '' : 's'} resolved, {summary.carried} carried forward.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 text-left">
                <StatCard label="Resolved" value={summary.resolved} color="text-green-600" />
                <StatCard label="Carry Forward" value={summary.carried} color="text-blue-600" />
                <StatCard label="Dismissed" value={summary.dismissed} color="text-gray-600" />
              </div>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button onClick={() => setStep('digest')} className={secondaryActionClass}>Review Again</button>
                <button onClick={closeReview} disabled={saving} className={`${primaryActionClass} disabled:opacity-50`}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Returning to Inbox...' : 'Return to Inbox'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
    <p className={cn('text-2xl font-bold', color)}>{value}</p>
    <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
  </div>
);

const digestCardTones = {
  slate: 'bg-slate-50 border-slate-200 text-slate-700',
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  amber: 'bg-amber-50 border-amber-200 text-amber-700',
  green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  red: 'bg-rose-50 border-rose-200 text-rose-700',
} as const;

const DigestStatCard: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone: keyof typeof digestCardTones;
}> = ({ icon: Icon, label, value, tone }) => (
  <div className={cn('rounded-xl border px-3 py-2', digestCardTones[tone])}>
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide opacity-90">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
    <p className="mt-1 text-xl font-semibold leading-none">{value}</p>
  </div>
);
