import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Inbox } from './components/Inbox';
import { PMMetrics } from './components/PMMetrics';
import { ReviewCompletionResult, WeeklyReview } from './components/WeeklyReview';
import { Menu, Search, Settings, HelpCircle, Grid, Inbox as InboxIcon, Send, File, CheckSquare, Star, Clock, Tag, Plus, ChevronDown, X, PenLine, Calendar, ListTodo, Info, Users, BarChart2 } from 'lucide-react';
import { cn } from './lib/utils';
import { mockEmails as initialEmails, MockEmail } from './services/mockData';
import { extractWeeklyReviewData, WeeklyReviewData } from './services/weeklyReviewService';
import { clearEmailState, loadEmailState, saveEmailState } from './services/emailStateStore';
import { CarryForwardItem, loadCarryForwardItems, loadCompletedReview, saveCarryForwardItems, saveCompletedReview } from './services/weeklyReviewStore';
import { DEFAULT_WEEKLY_REVIEW_CONFIG, getWeeklyReviewConfigKey, loadWeeklyReviewConfig, normalizeWeeklyReviewConfig, saveWeeklyReviewConfig, WeeklyReviewConfig } from './services/weeklyReviewConfig';
import { loadLatestReviewCompletionRecordForPeriod, loadPersistedThreadActionRecords, loadReviewCompletionRecord, PersistedThreadActionRecord, savePersistedThreadActionRecords, saveReviewCompletionRecordToDb } from './services/reviewActivityDb';

type WeeklyReviewSchedule = {
  enabled: boolean;
  dayOfWeek: number;
  hourOfDay: number;
  windowHours: number;
};

const DEFAULT_WEEKLY_SCHEDULE: WeeklyReviewSchedule = {
  enabled: true,
  dayOfWeek: 5,
  hourOfDay: 17,
  windowHours: 72,
};

const URGENT_SIGNAL_REGEX = /(urgent|asap|deadline|today|immediately|final reminder|escalat)/i;
const REVIEW_OWNER_REGEX = /rahul mehta|rahul/i;
const PREPARED_REVIEW_CONTEXT_KEY_STORAGE = 'weekly_review_prepared_context_key';
const PREPARED_REVIEW_REFERENCE_KEY_STORAGE = 'weekly_review_prepared_reference_key';
const REVIEW_CONTEXT_VERSION = 'review-context-v6';
const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function getLatestWorkWeekRange(now: Date, config: WeeklyReviewConfig): { start: Date; end: Date; key: string; label: string } {
  const normalizedConfig = normalizeWeeklyReviewConfig(config);
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);

  const reviewEndDayOfWeek = (normalizedConfig.reviewStartDayOfWeek + normalizedConfig.reviewSpanDays - 1) % 7;
  const daysSinceReviewEnd = (cursor.getDay() - reviewEndDayOfWeek + 7) % 7;
  const end = new Date(cursor);
  end.setDate(cursor.getDate() - daysSinceReviewEnd);

  const start = new Date(end);
  start.setDate(end.getDate() - (normalizedConfig.reviewSpanDays - 1));

  const key = `${getDateKey(start)}:${getDateKey(end)}`;
  const label = `Review week ${formatShortDate(start)} to ${formatShortDate(end)}`;

  return { start, end, key, label };
}

function parseSettingsList(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildCarryForwardContextEmail(item: CarryForwardItem, sourceEmail?: MockEmail): MockEmail {
  if (sourceEmail) {
    return sourceEmail;
  }

  return {
    id: item.threadId,
    subject: item.email.subject,
    sender: item.email.sender,
    snippet: item.email.snippet,
    date: item.email.date,
    unread: false,
    starred: false,
    category: 'primary',
    messages: [
      {
        id: `${item.threadId}-carry-forward`,
        sender: item.email.sender,
        body: item.email.snippet,
        date: item.email.date,
      },
    ],
  };
}

function getValidTimestamp(value: string): number | null {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getLatestThreadActivityTimestamp(email: MockEmail): number {
  const baseTs = getValidTimestamp(email.date) ?? 0;
  return email.messages.reduce((latest, message) => {
    const messageTs = getValidTimestamp(message.date);
    if (messageTs === null) {
      return latest;
    }

    return Math.max(latest, messageTs);
  }, baseTs);
}

function getExternalMessageTimestamps(email: MockEmail): number[] {
  const timestamps: number[] = [];

  if (!REVIEW_OWNER_REGEX.test(email.sender)) {
    const baseTs = getValidTimestamp(email.date);
    if (baseTs !== null) {
      timestamps.push(baseTs);
    }
  }

  email.messages.forEach((message) => {
    if (REVIEW_OWNER_REGEX.test(message.sender)) {
      return;
    }

    const messageTs = getValidTimestamp(message.date);
    if (messageTs !== null) {
      timestamps.push(messageTs);
    }
  });

  return timestamps;
}

function hasExternalActivityInRange(email: MockEmail, startMs: number, endMs: number): boolean {
  return getExternalMessageTimestamps(email).some((timestamp) => timestamp >= startMs && timestamp <= endMs);
}

function getLatestExternalActivityTimestamp(email: MockEmail): number {
  return getExternalMessageTimestamps(email).reduce((latest, timestamp) => Math.max(latest, timestamp), 0);
}

function buildReviewContextKey(
  reviewPeriodKey: string,
  emails: MockEmail[],
  carryForwardItems: CarryForwardItem[],
  reviewConfigKey: string,
  actionRecords: PersistedThreadActionRecord[],
): string {
  const emailTokens = emails
    .map((email) => `${email.id}:${getLatestThreadActivityTimestamp(email)}`)
    .sort((left, right) => left.localeCompare(right));
  const carryForwardTokens = carryForwardItems
    .map((item) => `${item.threadId}:${item.sourcePeriodKey}:${item.status}:${item.snoozeDate ?? ''}:${item.urgency}`)
    .sort((left, right) => left.localeCompare(right));
  const actionRecordTokens = actionRecords
    .map((record) => `${record.threadId}:${record.status}:${record.latestExternalActivityTs}:${record.updatedAt}`)
    .sort((left, right) => left.localeCompare(right));

  return [REVIEW_CONTEXT_VERSION, reviewPeriodKey, reviewConfigKey, ...emailTokens, '--carry-forward--', ...carryForwardTokens, '--actions--', ...actionRecordTokens].join('|');
}

function hasFreshResolvedAction(email: MockEmail, actionRecordsByThreadId: Map<string, PersistedThreadActionRecord>): boolean {
  const record = actionRecordsByThreadId.get(email.id);
  if (!record || (record.status !== 'resolved' && record.status !== 'dismissed')) {
    return false;
  }

  return getLatestExternalActivityTimestamp(email) <= record.latestExternalActivityTs;
}

function suppressCompletedActionsInReviewData(
  data: WeeklyReviewData,
  contextEmails: MockEmail[],
  actionRecordsByThreadId: Map<string, PersistedThreadActionRecord>,
): WeeklyReviewData {
  const contextEmailById = new Map(contextEmails.map((email) => [email.id, email]));
  const filteredActions = data.actions.filter((action) => {
    const email = contextEmailById.get(action.threadId);
    if (!email) {
      return true;
    }

    return !hasFreshResolvedAction(email, actionRecordsByThreadId);
  });

  const actionIds = new Set(filteredActions.map((action) => action.threadId));
  return {
    ...data,
    actions: filteredActions,
    themes: data.themes.map((theme) => ({
      ...theme,
      hasCriticalAction: theme.threadIds.some((threadId) =>
        filteredActions.some((action) => action.threadId === threadId && action.urgency === 'Critical'),
      ),
      summary: theme.summary,
      threadIds: theme.threadIds.filter((threadId) => contextEmailById.has(threadId)),
    })),
  };
}

function getReviewWindowStart(date: Date, schedule: WeeklyReviewSchedule): Date {
  const base = new Date(date);
  base.setHours(schedule.hourOfDay, 0, 0, 0);

  const daysBack = (base.getDay() - schedule.dayOfWeek + 7) % 7;
  base.setDate(base.getDate() - daysBack);

  if (base > date) {
    base.setDate(base.getDate() - 7);
  }

  return base;
}

function isInsideWeeklyReviewWindow(date: Date, schedule: WeeklyReviewSchedule): boolean {
  if (!schedule.enabled) {
    return false;
  }

  const start = getReviewWindowStart(date, schedule);
  const elapsed = date.getTime() - start.getTime();
  return elapsed >= 0 && elapsed <= schedule.windowHours * 60 * 60 * 1000;
}

export default function App() {
  type MailFolder = 'inbox' | 'starred' | 'snoozed' | 'sent' | 'drafts' | 'weekly-review' | 'purchases' | 'pm-metrics';

  const [fetchingEmails, setFetchingEmails] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<MailFolder>('inbox');
  const [emails, setEmails] = useState<MockEmail[]>(() => loadEmailState(initialEmails));
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewThreadToOpen, setReviewThreadToOpen] = useState<string | null>(null);
  const [reviewThreadFromReview, setReviewThreadFromReview] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAppsPanel, setShowAppsPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'timeline' | 'assistant' | 'senders'>('timeline');
  const [showTimeTravelPanel, setShowTimeTravelPanel] = useState(false);
  const timerButtonRef = useRef<HTMLButtonElement | null>(null);
  const [timePanelCoords, setTimePanelCoords] = useState({ top: 96, right: 16 });
  const [statusMessage, setStatusMessage] = useState('');
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [labels, setLabels] = useState<{ name: string; color: string }[]>([]);
  const [weeklyReviewSchedule, setWeeklyReviewSchedule] = useState<WeeklyReviewSchedule>(() => {
    try {
      const raw = localStorage.getItem('weekly_review_schedule');
      if (!raw) return DEFAULT_WEEKLY_SCHEDULE;
      const parsed = JSON.parse(raw) as WeeklyReviewSchedule;
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_WEEKLY_SCHEDULE.enabled,
        dayOfWeek: Number.isFinite(parsed.dayOfWeek) ? parsed.dayOfWeek : DEFAULT_WEEKLY_SCHEDULE.dayOfWeek,
        hourOfDay: Number.isFinite(parsed.hourOfDay) ? parsed.hourOfDay : DEFAULT_WEEKLY_SCHEDULE.hourOfDay,
        windowHours: Number.isFinite(parsed.windowHours) ? parsed.windowHours : DEFAULT_WEEKLY_SCHEDULE.windowHours,
      };
    } catch {
      return DEFAULT_WEEKLY_SCHEDULE;
    }
  });
  const [weeklyReviewConfig, setWeeklyReviewConfig] = useState<WeeklyReviewConfig>(() => loadWeeklyReviewConfig());
  const [carryForwardItems, setCarryForwardItems] = useState<CarryForwardItem[]>(() => {
    const stored = loadCarryForwardItems();
    if (stored.length > 0) {
      return stored;
    }

    try {
      const raw = localStorage.getItem('weekly_review_carry_forward');
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((threadId): CarryForwardItem | null => {
          if (typeof threadId !== 'string') {
            return null;
          }

          const email = initialEmails.find((item) => item.id === threadId);
          if (!email) {
            return null;
          }

          return {
            threadId,
            summary: `Follow up carried from last review: ${email.subject}`,
            urgency: 'High' as const,
            confidence: 65,
            status: 'carry-forward' as const,
            carriedAt: new Date().toISOString(),
            sourcePeriodKey: 'legacy',
            email: {
              subject: email.subject,
              sender: email.sender,
              snippet: email.snippet,
              date: email.date,
            },
          };
        })
        .filter((item): item is CarryForwardItem => item !== null);
    } catch {
      return [];
    }
  });
  const [bannerDismissedPeriod, setBannerDismissedPeriod] = useState<string | null>(() => localStorage.getItem('weekly_review_banner_dismissed_period'));
  const [bannerSnoozedUntil, setBannerSnoozedUntil] = useState<string | null>(() => localStorage.getItem('weekly_review_banner_snoozed_until'));
  const [preparedReviewPeriodKey, setPreparedReviewPeriodKey] = useState<string | null>(() => localStorage.getItem('weekly_review_prepared_period'));
  const [preparedReviewContextKey, setPreparedReviewContextKey] = useState<string | null>(() => localStorage.getItem(PREPARED_REVIEW_CONTEXT_KEY_STORAGE));
  const [preparedReviewReferenceKey, setPreparedReviewReferenceKey] = useState<string | null>(() => localStorage.getItem(PREPARED_REVIEW_REFERENCE_KEY_STORAGE));
  const [preparedReviewAt, setPreparedReviewAt] = useState<string | null>(() => localStorage.getItem('weekly_review_prepared_at'));
  const [preparedReviewLastEmailTs, setPreparedReviewLastEmailTs] = useState<number>(() => {
    const raw = localStorage.getItem('weekly_review_prepared_last_email_ts');
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  });
  const [preparedReviewData, setPreparedReviewData] = useState<WeeklyReviewData | null>(() => {
    try {
      const raw = localStorage.getItem('weekly_review_prepared_data');
      if (!raw) return null;
      return JSON.parse(raw) as WeeklyReviewData;
    } catch {
      return null;
    }
  });
  const [preparingReview, setPreparingReview] = useState(false);
  const [completedReview, setCompletedReview] = useState(() => loadCompletedReview());
  const [hasPendingActionsInReview, setHasPendingActionsInReview] = useState(false);
  const [reviewActionRecords, setReviewActionRecords] = useState<PersistedThreadActionRecord[]>([]);
  const [reviewDbReady, setReviewDbReady] = useState(false);
  const [demoNow, setDemoNow] = useState<string>('');

  const resolvedNow = demoNow ? new Date(demoNow) : new Date();
  const now = Number.isNaN(resolvedNow.getTime()) ? new Date() : resolvedNow;
  const usingDemoTime = Boolean(demoNow);
  const reviewPeriod = getLatestWorkWeekRange(now, weeklyReviewConfig);
  const reviewConfigKey = useMemo(() => getWeeklyReviewConfigKey(weeklyReviewConfig), [weeklyReviewConfig]);
  const reviewReferenceKey = usingDemoTime ? now.toISOString() : `live:${reviewPeriod.key}`;
  const weeklyReviewReferenceNow = useMemo(() => {
    if (usingDemoTime) {
      return now.toISOString();
    }

    const endOfReviewPeriod = new Date(reviewPeriod.end);
    endOfReviewPeriod.setHours(23, 59, 59, 999);
    return endOfReviewPeriod.toISOString();
  }, [demoNow, reviewPeriod.end, usingDemoTime]);
  const reviewWindowOpen = isInsideWeeklyReviewWindow(now, weeklyReviewSchedule);
  const reviewPeriodStart = new Date(reviewPeriod.start);
  reviewPeriodStart.setHours(0, 0, 0, 0);
  const reviewPeriodEnd = new Date(reviewPeriod.end);
  reviewPeriodEnd.setHours(23, 59, 59, 999);
  const reviewPeriodStartMs = reviewPeriodStart.getTime();
  const reviewPeriodEndMs = reviewPeriodEnd.getTime();
  const reviewActionRecordsByThreadId = useMemo(
    () => new Map(reviewActionRecords.map((record) => [record.threadId, record])),
    [reviewActionRecords],
  );
  const eligibleCarryForwardItems = carryForwardItems.filter((item) => item.sourcePeriodKey !== reviewPeriod.key);
  const reviewPeriodEmails = emails
    .filter((email) => hasExternalActivityInRange(email, reviewPeriodStartMs, reviewPeriodEndMs))
    .sort((a, b) => getLatestThreadActivityTimestamp(b) - getLatestThreadActivityTimestamp(a));
  const reviewContextEmails = useMemo(() => {
    const context = new Map<string, MockEmail>(reviewPeriodEmails.map((email) => [email.id, email]));

    eligibleCarryForwardItems.forEach((item) => {
      if (context.has(item.threadId)) {
        return;
      }

      const sourceEmail = emails.find((email) => email.id === item.threadId);
      context.set(item.threadId, buildCarryForwardContextEmail(item, sourceEmail));
    });

    return Array.from(context.values()).sort((a, b) => getLatestThreadActivityTimestamp(b) - getLatestThreadActivityTimestamp(a));
  }, [eligibleCarryForwardItems, emails, reviewPeriodEmails]);
  const reviewContextKey = useMemo(
    () => buildReviewContextKey(reviewPeriod.key, reviewContextEmails, eligibleCarryForwardItems, reviewConfigKey, reviewActionRecords),
    [eligibleCarryForwardItems, reviewActionRecords, reviewConfigKey, reviewContextEmails, reviewPeriod.key],
  );
  const newestEmailTs = reviewPeriodEmails.reduce((maxTs, email) => {
    const ts = getLatestExternalActivityTimestamp(email);
    return Number.isFinite(ts) ? Math.max(maxTs, ts) : maxTs;
  }, 0);
  const snoozeActive = Boolean(bannerSnoozedUntil && new Date(bannerSnoozedUntil) > now);
  const isPreparedForCurrentReview =
    preparedReviewPeriodKey === reviewPeriod.key &&
    preparedReviewContextKey === reviewContextKey &&
    preparedReviewReferenceKey === reviewReferenceKey &&
    Boolean(preparedReviewData);
  const newEmailsSincePrepared = isPreparedForCurrentReview && preparedReviewLastEmailTs > 0
    ? reviewPeriodEmails.filter((email) => getLatestExternalActivityTimestamp(email) > preparedReviewLastEmailTs)
    : [];
  const newSincePreparedCount = newEmailsSincePrepared.length;
  const hasCriticalNewSignals = newEmailsSincePrepared.some((email) => URGENT_SIGNAL_REGEX.test(`${email.subject} ${email.snippet}`));
  const isCurrentReviewCompleted = completedReview?.reviewPeriodKey === reviewPeriod.key;
  const canShowCompletedBadge = isCurrentReviewCompleted && !hasPendingActionsInReview;
  const isReviewBannerReady = reviewWindowOpen && !isCurrentReviewCompleted && bannerDismissedPeriod !== reviewPeriod.key && !snoozeActive;
  const primaryUnread = reviewPeriodEmails.filter((email) => email.unread && email.category === 'primary').length;
  const preparedPreview = isPreparedForCurrentReview && preparedReviewData
    ? `${preparedReviewData.actions.length} action items across ${preparedReviewData.themes.length} themes - ${primaryUnread} unread emails need attention`
    : reviewContextEmails.length > 0
      ? `${reviewPeriodEmails.length} emails this week - ${eligibleCarryForwardItems.length} carried forward`
      : `No review-week emails found`;

  const generatePreparedReview = async (reason: 'scheduled' | 'manual' | 'delta-critical') => {
    setPreparingReview(true);
    try {
      const data = reviewContextEmails.length > 0
        ? await extractWeeklyReviewData(reviewContextEmails, { referenceNow: weeklyReviewReferenceNow, config: weeklyReviewConfig })
        : { themes: [], actions: [] };
      const filteredData = suppressCompletedActionsInReviewData(data, reviewContextEmails, reviewActionRecordsByThreadId);
      setPreparedReviewData(filteredData);
      setPreparedReviewPeriodKey(reviewPeriod.key);
      setPreparedReviewContextKey(reviewContextKey);
      setPreparedReviewReferenceKey(reviewReferenceKey);
      setPreparedReviewAt(now.toISOString());
      setPreparedReviewLastEmailTs(newestEmailTs);

      if (reason === 'manual') {
        setStatusMessage('Weekly summary refreshed with latest emails.');
      }
      if (reason === 'delta-critical') {
        setStatusMessage('Weekly summary auto-updated for urgent new emails.');
      }
    } catch {
      setStatusMessage('Weekly review preparation failed. You can still open review manually.');
    } finally {
      setPreparingReview(false);
    }
  };

  const applyDemoPreset = (dayOfWeek: number, hourOfDay: number) => {
    const preset = new Date();
    preset.setHours(hourOfDay, 0, 0, 0);
    const shift = (dayOfWeek - preset.getDay() + 7) % 7;
    preset.setDate(preset.getDate() + shift);
    setDemoNow(toDateTimeLocalValue(preset));
    setStatusMessage(`Demo time set to ${preset.toLocaleString()}.`);
  };

  const openExternal = (url: string, label: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    setStatusMessage(`Opened ${label}.`);
  };

  const handleUpdateEmail = (id: string, updates: Partial<MockEmail>) => {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  const handleDeleteEmails = (ids: Set<string>) => {
    setEmails((prev) => prev.filter((e) => !ids.has(e.id)));
  };

  const refreshEmails = async () => {
    setFetchingEmails(true);
    // Simulate inbox refresh in demo mode.
    await new Promise((resolve) => setTimeout(resolve, 450));
    clearEmailState();
    setEmails(initialEmails);
    setFetchingEmails(false);
    setStatusMessage('Inbox refreshed with demo emails.');
  };

  const addLabel = () => {
    const name = window.prompt('New label name');
    if (!name || !name.trim()) {
      return;
    }

    const normalized = name.trim();
    if (labels.some(label => label.name.toLowerCase() === normalized.toLowerCase())) {
      setStatusMessage('That label already exists.');
      return;
    }

    const palette = ['bg-green-500', 'bg-blue-500', 'bg-orange-500', 'bg-purple-500'];
    const color = palette[labels.length % palette.length];
    setLabels(prev => [...prev, { name: normalized, color }]);
    setStatusMessage(`Label "${normalized}" added.`);
  };

  const sendCompose = () => {
    if (!composeTo.trim() || !composeSubject.trim()) {
      setStatusMessage('Add a recipient and subject before sending.');
      return;
    }

    setShowComposeModal(false);
    setStatusMessage(`Message queued for ${composeTo.trim()}.`);
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
  };

  const filteredEmails = useMemo(() => {
    if (!searchQuery.trim()) {
      return emails;
    }

    const query = searchQuery.toLowerCase();
    return emails.filter(email =>
      email.sender.toLowerCase().includes(query) ||
      email.subject.toLowerCase().includes(query) ||
      email.snippet.toLowerCase().includes(query)
    );
  }, [emails, searchQuery]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => setStatusMessage(''), 3000);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    if (!showTimeTravelPanel) return;

    const updatePanelPosition = () => {
      if (!timerButtonRef.current) return;
      const rect = timerButtonRef.current.getBoundingClientRect();
      setTimePanelCoords({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };

    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [showTimeTravelPanel]);

  useEffect(() => {
    localStorage.setItem('weekly_review_schedule', JSON.stringify(weeklyReviewSchedule));
  }, [weeklyReviewSchedule]);

  useEffect(() => {
    saveWeeklyReviewConfig(weeklyReviewConfig);
  }, [weeklyReviewConfig]);

  useEffect(() => {
    let cancelled = false;

    const loadReviewDbState = async () => {
      const [records, completionRecord, completionRecordForPeriod] = await Promise.all([
        loadPersistedThreadActionRecords(),
        loadReviewCompletionRecord(reviewPeriod.key, reviewContextKey),
        loadLatestReviewCompletionRecordForPeriod(reviewPeriod.key),
      ]);

      if (cancelled) {
        return;
      }

      setReviewActionRecords(records);
      setCompletedReview(completionRecordForPeriod ?? completionRecord ?? null);
      setReviewDbReady(true);
    };

    void loadReviewDbState();

    return () => {
      cancelled = true;
    };
  }, [reviewContextKey, reviewPeriod.key]);

  useEffect(() => {
    saveEmailState(emails);
  }, [emails]);

  useEffect(() => {
    saveCarryForwardItems(carryForwardItems);
  }, [carryForwardItems]);

  useEffect(() => {
    if (bannerDismissedPeriod) localStorage.setItem('weekly_review_banner_dismissed_period', bannerDismissedPeriod);
    else localStorage.removeItem('weekly_review_banner_dismissed_period');
  }, [bannerDismissedPeriod]);

  useEffect(() => {
    if (bannerSnoozedUntil) localStorage.setItem('weekly_review_banner_snoozed_until', bannerSnoozedUntil);
    else localStorage.removeItem('weekly_review_banner_snoozed_until');
  }, [bannerSnoozedUntil]);

  useEffect(() => {
    if (preparedReviewPeriodKey) localStorage.setItem('weekly_review_prepared_period', preparedReviewPeriodKey);
    else localStorage.removeItem('weekly_review_prepared_period');
  }, [preparedReviewPeriodKey]);

  useEffect(() => {
    if (preparedReviewAt) localStorage.setItem('weekly_review_prepared_at', preparedReviewAt);
    else localStorage.removeItem('weekly_review_prepared_at');
  }, [preparedReviewAt]);

  useEffect(() => {
    if (preparedReviewContextKey) localStorage.setItem(PREPARED_REVIEW_CONTEXT_KEY_STORAGE, preparedReviewContextKey);
    else localStorage.removeItem(PREPARED_REVIEW_CONTEXT_KEY_STORAGE);
  }, [preparedReviewContextKey]);

  useEffect(() => {
    if (preparedReviewReferenceKey) localStorage.setItem(PREPARED_REVIEW_REFERENCE_KEY_STORAGE, preparedReviewReferenceKey);
    else localStorage.removeItem(PREPARED_REVIEW_REFERENCE_KEY_STORAGE);
  }, [preparedReviewReferenceKey]);

  useEffect(() => {
    if (preparedReviewLastEmailTs > 0) localStorage.setItem('weekly_review_prepared_last_email_ts', String(preparedReviewLastEmailTs));
    else localStorage.removeItem('weekly_review_prepared_last_email_ts');
  }, [preparedReviewLastEmailTs]);

  useEffect(() => {
    if (preparedReviewData) localStorage.setItem('weekly_review_prepared_data', JSON.stringify(preparedReviewData));
    else localStorage.removeItem('weekly_review_prepared_data');
  }, [preparedReviewData]);

  useEffect(() => {
    if (!reviewDbReady || !reviewWindowOpen || isPreparedForCurrentReview || preparingReview || isCurrentReviewCompleted) {
      return;
    }

    void generatePreparedReview('scheduled');
  }, [isCurrentReviewCompleted, isPreparedForCurrentReview, preparingReview, reviewDbReady, reviewWindowOpen]);

  useEffect(() => {
    if (!reviewDbReady || !reviewWindowOpen || !isPreparedForCurrentReview || preparingReview || isCurrentReviewCompleted) {
      return;
    }

    if (hasCriticalNewSignals) {
      void generatePreparedReview('delta-critical');
    }
  }, [hasCriticalNewSignals, isCurrentReviewCompleted, isPreparedForCurrentReview, preparingReview, reviewDbReady, reviewWindowOpen]);

  useEffect(() => {
    setHasPendingActionsInReview(false);
  }, [reviewPeriod.key]);

  const dismissReviewBanner = () => {
    setBannerDismissedPeriod(reviewPeriod.key);
    setStatusMessage('Weekly review reminder dismissed for this review cycle.');
  };

  const snoozeReviewBanner = () => {
    const until = new Date(now);
    until.setHours(until.getHours() + 2);
    setBannerSnoozedUntil(until.toISOString());
    setStatusMessage('Weekly review reminder snoozed for 2 hours.');
  };

  const restoreReviewBanner = () => {
    setBannerDismissedPeriod(null);
    setBannerSnoozedUntil(null);
  };

  const resetReviewSnooze = () => {
    setBannerSnoozedUntil(null);
    setStatusMessage('Weekly reminder snooze reset.');
  };

  const updateWeeklyReviewSchedule = (updates: Partial<WeeklyReviewSchedule>, message: string) => {
    setWeeklyReviewSchedule((prev) => ({ ...prev, ...updates }));
    setStatusMessage(message);
  };

  const updateWeeklyReviewConfig = (updates: Partial<WeeklyReviewConfig>, message: string, syncReminderDay = false) => {
    const nextConfig = normalizeWeeklyReviewConfig({ ...weeklyReviewConfig, ...updates });
    setWeeklyReviewConfig(nextConfig);

    if (syncReminderDay) {
      const reviewEndDayOfWeek = (nextConfig.reviewStartDayOfWeek + nextConfig.reviewSpanDays - 1) % 7;
      setWeeklyReviewSchedule((prev) => ({ ...prev, dayOfWeek: reviewEndDayOfWeek }));
    }

    setStatusMessage(message);
  };

  const handleWeeklyReviewComplete = (result: ReviewCompletionResult) => {
    setCarryForwardItems(result.carryForwardItems);
    const updatedActionRecords = result.actionDecisions
      .filter((decision): decision is typeof decision & { status: PersistedThreadActionRecord['status'] } => decision.status !== 'pending')
      .map((decision) => {
        const email = reviewContextEmails.find((item) => item.id === decision.threadId);
        const latestExternalActivityTs = email ? getLatestExternalActivityTimestamp(email) : new Date(result.completedAt).getTime();
        return {
          threadId: decision.threadId,
          status: decision.status,
          artifact: decision.artifact,
          latestExternalActivityTs,
          reviewContextKey,
          reviewPeriodKey: reviewPeriod.key,
          summary: email?.subject || decision.threadId,
          updatedAt: result.completedAt,
        } satisfies PersistedThreadActionRecord;
      });
    const nextActionRecords = Array.from(new Map(
      [...reviewActionRecords, ...updatedActionRecords].map((record) => [record.threadId, record]),
    ).values());
    const nextReviewContextKey = buildReviewContextKey(
      reviewPeriod.key,
      reviewContextEmails,
      eligibleCarryForwardItems,
      reviewConfigKey,
      nextActionRecords,
    );
    const completedRecord = {
      reviewPeriodKey: reviewPeriod.key,
      reviewContextKey: nextReviewContextKey,
      reviewPeriodLabel: reviewPeriod.label,
      completedAt: result.completedAt,
      actionDecisions: result.actionDecisions,
      carryForwardCount: result.carryForwardItems.length,
      summary: result.summary,
    };
    saveCompletedReview(completedRecord);
    void saveReviewCompletionRecordToDb(completedRecord);
    setReviewActionRecords(nextActionRecords);
    void savePersistedThreadActionRecords(nextActionRecords);
    setCompletedReview(completedRecord);
    setCurrentFolder('inbox');
    setStatusMessage(`Weekly review saved: ${result.summary.resolved} resolved, ${result.summary.carried} carried.`);
  };

  return (
    <div className="flex flex-col h-screen bg-white text-gray-900 font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-white z-10">
        <div className="flex items-center gap-4 w-64">
          <button
            onClick={() => setSidebarCollapsed(prev => !prev)}
            className="p-3 hover:bg-gray-100 rounded-full text-gray-600"
            title={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <img src="https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg" alt="Gmail" className="h-8 w-8 object-contain" />
            <span className="text-2xl font-medium text-gray-600 tracking-tight">Gmail</span>
          </div>
        </div>
        
        <div className="flex-1 max-w-3xl px-4">
          <div className="flex items-center bg-[#eaf1fb] rounded-full px-4 py-3 focus-within:bg-white focus-within:shadow-md transition-all">
            <Search className="h-5 w-5 text-gray-600 mr-3" />
            <input 
              type="text" 
              placeholder="Search mail" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-base text-gray-700 placeholder-gray-600"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 w-64 justify-end pr-2">
          <button
            onClick={() => openExternal('https://support.google.com/mail/', 'Gmail Help')}
            className="p-2.5 hover:bg-gray-100 rounded-full text-gray-600"
            title="Help"
          >
            <HelpCircle className="h-6 w-6" />
          </button>
          <button
            onClick={() => {
              setSettingsSection('timeline');
              setShowSettingsPanel(prev => !prev);
            }}
            className="p-2.5 hover:bg-gray-100 rounded-full text-gray-600"
            title="Settings"
          >
            <Settings className="h-6 w-6" />
          </button>
          <button
            onClick={() => setShowAppsPanel(prev => !prev)}
            className="p-2.5 hover:bg-gray-100 rounded-full text-gray-600"
            title="Google apps"
          >
            <Grid className="h-6 w-6" />
          </button>
          <button
            ref={timerButtonRef}
            onClick={() => setShowTimeTravelPanel(prev => !prev)}
            className={cn('p-2.5 rounded-full', showTimeTravelPanel ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600')}
            title="Demo time"
          >
            <Clock className="h-6 w-6" />
          </button>
          <button
            onClick={() => setStatusMessage('Demo mode active. Firebase is removed.')}
            className="ml-2 h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium text-sm overflow-hidden border-2 border-white shadow-sm"
            title="Demo mode"
          >
            D
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className={cn('flex-shrink-0 bg-white py-2 flex flex-col transition-all duration-200', sidebarCollapsed ? 'w-20' : 'w-64')}>
          <div className={cn('mb-4', sidebarCollapsed ? 'px-2' : 'px-3')}>
            <button
              onClick={() => setShowComposeModal(true)}
              className={cn('bg-[#c2e7ff] hover:bg-[#b3dcf4] text-[#001d35] rounded-2xl font-medium transition-colors shadow-sm', sidebarCollapsed ? 'w-full flex justify-center p-4' : 'flex items-center gap-4 px-5 py-4')}
              title="Compose"
            >
              <svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M20.41 4.94l-1.35-1.35c-.78-.78-2.05-.78-2.83 0L13.4 6.41 3 16.82V21h4.18l10.46-10.46 2.77-2.77c.79-.78.79-2.05 0-2.83zm-14 14.12L5 19v-1.36l9.82-9.82 1.41 1.41-9.82 9.83z"/></svg>
              {!sidebarCollapsed && <span className="text-sm font-medium">Compose</span>}
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <ul className={cn('space-y-0.5', sidebarCollapsed ? 'px-2' : 'pr-4')}>
              <li>
                <button 
                  onClick={() => setCurrentFolder('inbox')}
                  title="Inbox"
                  className={cn(
                    'w-full flex items-center text-sm',
                    sidebarCollapsed ? 'justify-center py-2 rounded-full' : 'justify-between px-6 py-1.5 rounded-r-full',
                    currentFolder === 'inbox' ? 'bg-[#d3e3fd] text-[#041e49] font-semibold' : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <div className={cn('flex items-center', sidebarCollapsed ? 'gap-0' : 'gap-4')}>
                    <InboxIcon className={cn("h-5 w-5", currentFolder === 'inbox' ? 'text-[#041e49]' : 'text-gray-600')} />
                    {!sidebarCollapsed && 'Inbox'}
                  </div>
                  {!sidebarCollapsed && emails.filter(e => e.unread).length > 0 && <span className="text-xs font-bold">{emails.filter(e => e.unread).length}</span>}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setCurrentFolder('starred')}
                  title="Starred"
                  className={cn(
                    'w-full flex items-center text-sm',
                    sidebarCollapsed ? 'justify-center py-2 rounded-full' : 'gap-4 px-6 py-1.5 rounded-r-full',
                    currentFolder === 'starred' ? 'bg-[#d3e3fd] text-[#041e49] font-semibold' : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Star className={cn("h-5 w-5", currentFolder === 'starred' ? 'text-[#041e49]' : 'text-gray-600')} />
                  {!sidebarCollapsed && 'Starred'}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setCurrentFolder('snoozed')}
                  title="Snoozed"
                  className={cn(
                    'w-full flex items-center text-sm',
                    sidebarCollapsed ? 'justify-center py-2 rounded-full' : 'gap-4 px-6 py-1.5 rounded-r-full',
                    currentFolder === 'snoozed' ? 'bg-[#d3e3fd] text-[#041e49] font-semibold' : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Clock className={cn("h-5 w-5", currentFolder === 'snoozed' ? 'text-[#041e49]' : 'text-gray-600')} />
                  {!sidebarCollapsed && 'Snoozed'}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setCurrentFolder('sent')}
                  title="Sent"
                  className={cn(
                    'w-full flex items-center text-sm',
                    sidebarCollapsed ? 'justify-center py-2 rounded-full' : 'gap-4 px-6 py-1.5 rounded-r-full',
                    currentFolder === 'sent' ? 'bg-[#d3e3fd] text-[#041e49] font-semibold' : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Send className={cn("h-5 w-5", currentFolder === 'sent' ? 'text-[#041e49]' : 'text-gray-600')} />
                  {!sidebarCollapsed && 'Sent'}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setCurrentFolder('drafts')}
                  title="Drafts"
                  className={cn(
                    'w-full flex items-center text-sm',
                    sidebarCollapsed ? 'justify-center py-2 rounded-full' : 'justify-between px-6 py-1.5 rounded-r-full',
                    currentFolder === 'drafts' ? 'bg-[#d3e3fd] text-[#041e49] font-semibold' : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <div className={cn('flex items-center', sidebarCollapsed ? 'gap-0' : 'gap-4')}>
                    <File className={cn("h-5 w-5", currentFolder === 'drafts' ? 'text-[#041e49]' : 'text-gray-600')} />
                    {!sidebarCollapsed && 'Drafts'}
                  </div>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentFolder('purchases')}
                  title="Purchases"
                  className={cn(
                    'w-full flex items-center text-sm text-gray-700 hover:bg-gray-100',
                    sidebarCollapsed ? 'justify-center py-2 rounded-full' : 'gap-4 px-6 py-1.5 rounded-r-full'
                  )}
                >
                  <Tag className="h-5 w-5 text-gray-600" />
                  {!sidebarCollapsed && 'Purchases'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setSidebarCollapsed(false)}
                  title="More"
                  className={cn(
                    'w-full flex items-center text-sm text-gray-700 hover:bg-gray-100',
                    sidebarCollapsed ? 'justify-center py-2 rounded-full' : 'gap-4 px-6 py-1.5 rounded-r-full'
                  )}
                >
                  <ChevronDown className="h-5 w-5 text-gray-600" />
                  {!sidebarCollapsed && 'More'}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setCurrentFolder('weekly-review')}
                  title="Weekly Review"
                  className={cn(
                    'w-full flex items-center text-sm mt-2',
                    sidebarCollapsed ? 'justify-center py-2 rounded-full' : 'gap-4 px-6 py-1.5 rounded-r-full',
                    currentFolder === 'weekly-review' ? 'bg-[#d3e3fd] text-[#041e49] font-semibold' : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <CheckSquare className={cn("h-5 w-5", currentFolder === 'weekly-review' ? 'text-[#041e49]' : 'text-gray-600')} />
                  {!sidebarCollapsed && (
                    canShowCompletedBadge ? (
                      <>
                        <span>Weekly Review</span>
                        <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-700">
                          Completed
                        </span>
                      </>
                    ) : (
                      <>
                        <span>Weekly Review</span>
                        {reviewWindowOpen && (
                          <span
                            className={cn(
                              'ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                              preparingReview
                                ? 'bg-amber-100 text-amber-700'
                                : newSincePreparedCount > 0
                                  ? 'bg-orange-100 text-orange-700'
                                  : isPreparedForCurrentReview
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-600'
                            )}
                          >
                            {preparingReview
                              ? 'Preparing'
                              : newSincePreparedCount > 0
                                ? `${newSincePreparedCount} New`
                                : isPreparedForCurrentReview
                                  ? 'Ready'
                                  : 'Queued'}
                          </span>
                        )}
                      </>
                    )
                  )}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentFolder('pm-metrics')}
                  title="PM Metrics"
                  className={cn(
                    'w-full flex items-center text-sm mt-1 mb-2',
                    sidebarCollapsed ? 'justify-center py-2 rounded-full' : 'gap-4 px-6 py-1.5 rounded-r-full',
                    currentFolder === 'pm-metrics' ? 'bg-[#d3e3fd] text-[#041e49] font-semibold' : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <BarChart2 className={cn("h-5 w-5", currentFolder === 'pm-metrics' ? 'text-[#041e49]' : 'text-gray-600')} />
                  {!sidebarCollapsed && 'PM Metrics'}
                </button>
              </li>
            </ul>

            <div className={cn('mt-6', sidebarCollapsed && 'hidden')}>
              <div onClick={addLabel} className="flex items-center justify-between px-6 py-2 group cursor-pointer">
                <span className="text-sm font-medium text-gray-800">Labels</span>
                <Plus className="h-4 w-4 text-gray-500 opacity-0 group-hover:opacity-100" />
              </div>
              <ul className="space-y-0.5 pr-4 mt-1">
                {labels.map((label) => (
                  <li key={label.name}>
                    <button
                      onClick={() => setSearchQuery(label.name)}
                      className="w-full flex items-center gap-4 px-6 py-1.5 rounded-r-full text-sm text-gray-700 hover:bg-gray-100"
                      title={`Filter by ${label.name}`}
                    >
                      <div className={cn('w-3 h-3 rounded-sm', label.color)}></div>
                      {label.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-white rounded-2xl mr-2 mb-2 shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]">
          {fetchingEmails ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p>Loading your emails...</p>
            </div>
          ) : currentFolder === 'weekly-review' ? (
              <WeeklyReview
                key={`${reviewPeriod.key}::${reviewReferenceKey}`}
                actionHistoryRecords={reviewActionRecords}
                emails={reviewContextEmails}
                allEmails={emails}
                initialCarryForwardItems={eligibleCarryForwardItems}
                referenceNow={weeklyReviewReferenceNow}
                referenceNowKey={reviewReferenceKey}
                reviewConfig={weeklyReviewConfig}
                reviewPeriodLabel={reviewPeriod.label}
                reviewPeriodKey={reviewPeriod.key}
                reviewContextKey={reviewContextKey}
                completedReviewRecord={isCurrentReviewCompleted ? completedReview : null}
                preloadedData={isPreparedForCurrentReview ? preparedReviewData : null}
                onPendingActionsChange={setHasPendingActionsInReview}
                onOpenThread={(threadId) => {
                  setCurrentFolder('inbox');
                  setReviewThreadToOpen(threadId);
                  setReviewThreadFromReview(true);
                  setStatusMessage('Opened source email from action item.');
                }}
                onComplete={handleWeeklyReviewComplete}
              />
          ) : currentFolder === 'pm-metrics' ? (
            <PMMetrics />
          ) : (
            <Inbox 
              folder={currentFolder} 
              emails={currentFolder === 'purchases' ? filteredEmails.filter(email => email.category === 'promotions') : filteredEmails}
              onUpdateEmail={handleUpdateEmail}
              onDeleteEmails={handleDeleteEmails}
              onRefresh={refreshEmails}
              onStartReview={() => setCurrentFolder('weekly-review')}
              weeklyReviewReady={isReviewBannerReady}
              weeklyReviewWindowOpen={reviewWindowOpen}
              weeklyReviewSnoozed={snoozeActive}
              weeklyReviewPrepared={isPreparedForCurrentReview}
              weeklyReviewPreparing={reviewWindowOpen && !isPreparedForCurrentReview && preparingReview}
              weeklyReviewPeriodLabel={reviewPeriod.label}
              weeklyReviewPreview={preparedPreview}
              weeklyReviewPreparedAt={preparedReviewAt}
              weeklyReviewNewSincePrepared={newSincePreparedCount}
              reviewThreadToOpen={reviewThreadToOpen}
              onReviewThreadOpened={() => setReviewThreadToOpen(null)}
              showBackToReview={reviewThreadFromReview}
              onBackToReview={() => {
                setCurrentFolder('weekly-review');
                setReviewThreadFromReview(false);
              }}
              onRefreshReviewSummary={() => void generatePreparedReview('manual')}
              onDismissReviewBanner={dismissReviewBanner}
              onSnoozeReviewBanner={snoozeReviewBanner}
              onRestoreReviewBanner={restoreReviewBanner}
            />
          )}
        </main>

        {/* Right Sidebar */}
        <aside className="w-14 flex-shrink-0 bg-white flex flex-col items-center py-4 gap-6 border-l border-gray-100">
          <button onClick={() => openExternal('https://calendar.google.com', 'Google Calendar')} className="p-2 hover:bg-blue-50 rounded-full text-blue-600" title="Calendar">
            <Calendar className="w-5 h-5" />
          </button>
          <button onClick={() => openExternal('https://keep.google.com', 'Google Keep')} className="p-2 hover:bg-amber-50 rounded-full text-amber-600" title="Keep">
            <Info className="w-5 h-5" />
          </button>
          <button onClick={() => openExternal('https://tasks.google.com', 'Google Tasks')} className="p-2 hover:bg-green-50 rounded-full text-green-600" title="Tasks">
            <ListTodo className="w-5 h-5" />
          </button>
          <button onClick={() => openExternal('https://contacts.google.com', 'Google Contacts')} className="p-2 hover:bg-indigo-50 rounded-full text-indigo-600" title="Contacts">
            <Users className="w-5 h-5" />
          </button>
          <div className="w-5 h-px bg-gray-200 my-2"></div>
          <button onClick={() => openExternal('https://workspace.google.com/marketplace', 'Workspace Marketplace')} className="p-2 hover:bg-gray-100 rounded-full text-gray-600" title="Get add-ons">
            <Plus className="w-5 h-5" />
          </button>
        </aside>
      </div>

      {showSettingsPanel && (
        <div className="fixed inset-y-0 right-0 z-30 h-full w-full max-w-[560px] overflow-y-auto border-l border-gray-200 bg-white p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Weekly review settings</h3>
              <p className="mt-1 text-sm text-gray-500">Adjust the review timeline, assistant behavior, and priority senders from one place.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">Auto-saved</span>
              <button
                onClick={() => setShowSettingsPanel(false)}
                className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100"
                title="Close settings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white bg-white px-3 py-2 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Scope</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{WEEKDAY_LABELS[weeklyReviewConfig.reviewStartDayOfWeek]} to {WEEKDAY_LABELS[(weeklyReviewConfig.reviewStartDayOfWeek + weeklyReviewConfig.reviewSpanDays - 1) % 7]}</p>
            </div>
            <div className="rounded-xl border border-white bg-white px-3 py-2 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Themes</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{weeklyReviewConfig.defaultThemeHints.length} preferred hints</p>
            </div>
            <div className="rounded-xl border border-white bg-white px-3 py-2 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Priority senders</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{weeklyReviewConfig.officialEmailList.length} tracked</p>
            </div>
          </div>
          <div className="inline-flex rounded-full bg-slate-100 p-1">
            {[
              { id: 'timeline', label: 'Timeline', icon: Clock },
              { id: 'assistant', label: 'Assistant', icon: PenLine },
              { id: 'senders', label: 'Senders', icon: Users },
            ].map((item) => {
              const Icon = item.icon;
              const active = settingsSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSettingsSection(item.id as typeof settingsSection)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className={cn('space-y-3 rounded-3xl border border-gray-200 p-5', settingsSection !== 'timeline' && 'hidden')}>
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-blue-50 p-2 text-blue-600"><Clock className="h-4 w-4" /></div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900">Reminder timing</h4>
                <p className="mt-1 text-xs text-gray-500">Control when the weekly review prompt appears and how long it stays visible.</p>
              </div>
            </div>
            <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <span>
                <span className="block font-medium text-gray-900">Enable weekly reminder</span>
                <span className="block text-xs text-gray-500">Turn the inbox banner on or off.</span>
              </span>
              <input
                type="checkbox"
                checked={weeklyReviewSchedule.enabled}
                onChange={(e) => updateWeeklyReviewSchedule({ enabled: e.target.checked }, e.target.checked ? 'Weekly review reminder enabled.' : 'Weekly review reminder disabled.')}
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block text-xs text-gray-600">
                Reminder day
                <select
                  value={weeklyReviewSchedule.dayOfWeek}
                  onChange={(e) => {
                    const day = Number(e.target.value);
                    const dayName = WEEKDAY_LABELS[day] || 'selected day';
                    updateWeeklyReviewSchedule({ dayOfWeek: day }, `Weekly review day set to ${dayName}.`);
                  }}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                >
                  {WEEKDAY_LABELS.map((day, index) => (
                    <option key={day} value={index}>{day}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-gray-600">
                Reminder time
                <select
                  value={weeklyReviewSchedule.hourOfDay}
                  onChange={(e) => {
                    const hour = Number(e.target.value);
                    const label = `${String(hour).padStart(2, '0')}:00`;
                    updateWeeklyReviewSchedule({ hourOfDay: hour }, `Weekly review time set to ${label}.`);
                  }}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value={9}>09:00</option>
                  <option value={12}>12:00</option>
                  <option value={15}>15:00</option>
                  <option value={17}>17:00</option>
                  <option value={19}>19:00</option>
                </select>
              </label>
              <label className="block text-xs text-gray-600">
                Reminder window
                <select
                  value={weeklyReviewSchedule.windowHours}
                  onChange={(e) => {
                    const hours = Number(e.target.value);
                    updateWeeklyReviewSchedule({ windowHours: hours }, `Reminder window updated to ${hours} hours.`);
                  }}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>72 hours</option>
                  <option value={120}>5 days</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                onClick={() => {
                  restoreReviewBanner();
                  setShowSettingsPanel(false);
                }}
                className="rounded-xl border border-gray-300 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                Show weekly banner now
              </button>
              <button
                onClick={() => {
                  resetReviewSnooze();
                  setShowSettingsPanel(false);
                }}
                className="rounded-xl border border-gray-300 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                Reset reminder snooze
              </button>
            </div>
          </div>

          <div className={cn('space-y-3 rounded-3xl border border-gray-200 p-5', settingsSection !== 'assistant' && 'hidden')}>
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-violet-50 p-2 text-violet-600"><PenLine className="h-4 w-4" /></div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900">Review blueprint</h4>
                <p className="mt-1 text-xs text-gray-500">Define which days belong to the review and how the assistant should group and prioritize emails.</p>
              </div>
              <button
                onClick={() => {
                  setWeeklyReviewConfig(DEFAULT_WEEKLY_REVIEW_CONFIG);
                  setWeeklyReviewSchedule((prev) => ({
                    ...prev,
                    dayOfWeek: (DEFAULT_WEEKLY_REVIEW_CONFIG.reviewStartDayOfWeek + DEFAULT_WEEKLY_REVIEW_CONFIG.reviewSpanDays - 1) % 7,
                  }));
                  setStatusMessage('Weekly review settings reset to defaults.');
                }}
                className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Reset defaults
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs text-gray-600">
                Review starts on
                <select
                  value={weeklyReviewConfig.reviewStartDayOfWeek}
                  onChange={(e) => {
                    const startDay = Number(e.target.value);
                    const endDay = (startDay + weeklyReviewConfig.reviewSpanDays - 1) % 7;
                    updateWeeklyReviewConfig(
                      { reviewStartDayOfWeek: startDay },
                      `Review scope now runs ${WEEKDAY_LABELS[startDay]} to ${WEEKDAY_LABELS[endDay]}. Reminder day synced to ${WEEKDAY_LABELS[endDay]}.`,
                      true,
                    );
                  }}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                >
                  {WEEKDAY_LABELS.map((day, index) => (
                    <option key={day} value={index}>{day}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-gray-600">
                Review span
                <select
                  value={weeklyReviewConfig.reviewSpanDays}
                  onChange={(e) => {
                    const reviewSpanDays = Number(e.target.value);
                    const endDay = (weeklyReviewConfig.reviewStartDayOfWeek + reviewSpanDays - 1) % 7;
                    updateWeeklyReviewConfig(
                      { reviewSpanDays },
                      `Review span updated to ${reviewSpanDays} days. Reminder day synced to ${WEEKDAY_LABELS[endDay]}.`,
                      true,
                    );
                  }}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value={5}>5 days</option>
                  <option value={6}>6 days</option>
                  <option value={7}>7 days</option>
                  <option value={10}>10 days</option>
                  <option value={14}>14 days</option>
                </select>
              </label>
            </div>
            <label className="block text-xs text-gray-600">
              Custom categorization guidance
              <textarea
                value={weeklyReviewConfig.customPromptGuidance}
                onChange={(e) => setWeeklyReviewConfig(normalizeWeeklyReviewConfig({ ...weeklyReviewConfig, customPromptGuidance: e.target.value }))}
                rows={3}
                className="mt-1 w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm"
                placeholder="Example: prioritize investor, compliance, and launch decisions; suppress no-reply notifications."
              />
            </label>
            <label className="block text-xs text-gray-600">
              Preferred themes
              <textarea
                value={weeklyReviewConfig.defaultThemeHints.join('\n')}
                onChange={(e) => setWeeklyReviewConfig(normalizeWeeklyReviewConfig({ ...weeklyReviewConfig, defaultThemeHints: parseSettingsList(e.target.value) }))}
                rows={4}
                className="mt-1 w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm"
                placeholder="One per line, for example: Executive Decisions"
              />
            </label>
          </div>

          <div className={cn('space-y-3 rounded-3xl border border-gray-200 p-5', settingsSection !== 'senders' && 'hidden')}>
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-emerald-50 p-2 text-emerald-600"><Users className="h-4 w-4" /></div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900">Priority senders</h4>
                <p className="mt-1 text-xs text-gray-500">Emails from these senders or domains are treated as higher-signal during weekly review.</p>
              </div>
            </div>
            <label className="block text-xs text-gray-600">
              Official email list
              <textarea
                value={weeklyReviewConfig.officialEmailList.join('\n')}
                onChange={(e) => setWeeklyReviewConfig(normalizeWeeklyReviewConfig({ ...weeklyReviewConfig, officialEmailList: parseSettingsList(e.target.value) }))}
                rows={4}
                className="mt-1 w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm"
                placeholder="Enter sender emails or domains, one per line"
              />
            </label>
            <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
              Tip: add domains like `@board.company.com` or direct senders like `ceo@company.com`.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusMessage('Search cleared.');
              }}
              className="rounded-xl border border-gray-300 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              Clear search
            </button>
            <button
              onClick={() => {
                setCurrentFolder('inbox');
                setShowSettingsPanel(false);
                setStatusMessage('Returned to inbox.');
              }}
              className="rounded-xl border border-gray-300 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              Return to inbox
            </button>
            <button
              onClick={() => {
                void refreshEmails();
                setShowSettingsPanel(false);
              }}
              className="rounded-xl border border-gray-300 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              Refresh now
            </button>
          </div>
        </div>
      )}

      {showAppsPanel && (
        <div className="absolute right-20 top-20 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Google apps</h3>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => openExternal('https://mail.google.com', 'Gmail')} className="px-3 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-50">Gmail</button>
            <button onClick={() => openExternal('https://calendar.google.com', 'Calendar')} className="px-3 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-50">Calendar</button>
            <button onClick={() => openExternal('https://docs.google.com', 'Google Docs')} className="px-3 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-50">Docs</button>
            <button onClick={() => openExternal('https://drive.google.com', 'Google Drive')} className="px-3 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-50">Drive</button>
          </div>
        </div>
      )}

      {showTimeTravelPanel && (
        <div
          className="absolute w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-4 space-y-3"
          style={{ top: `${timePanelCoords.top}px`, right: `${timePanelCoords.right}px` }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Demo time control</h3>
            <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', reviewWindowOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
              {reviewWindowOpen ? 'Review window open' : 'Review window closed'}
            </span>
          </div>

          <p className="text-xs text-gray-600">
            Active time: {now.toLocaleString()} {usingDemoTime ? '(manual)' : '(system)'}
          </p>

          <label className="block text-xs text-gray-600">
            Set custom date and time
            <input
              type="datetime-local"
              value={demoNow}
              onChange={(e) => setDemoNow(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => applyDemoPreset(5, 18)}
              className="px-3 py-2 rounded-md border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
            >
              Friday 6:00 PM
            </button>
            <button
              onClick={() => applyDemoPreset(6, 11)}
              className="px-3 py-2 rounded-md border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
            >
              Saturday 11:00 AM
            </button>
            <button
              onClick={() => applyDemoPreset(1, 17)}
              className="px-3 py-2 rounded-md border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
            >
              Monday 5:00 PM
            </button>
            <button
              onClick={() => applyDemoPreset(2, 9)}
              className="px-3 py-2 rounded-md border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
            >
              Tuesday 9:00 AM
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={resetReviewSnooze}
                className="px-3 py-1.5 rounded-md text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Reset snooze
              </button>
              <button
                onClick={() => {
                  setDemoNow('');
                  setStatusMessage('Using live system time.');
                }}
                className="px-3 py-1.5 rounded-md text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Use system time
              </button>
            </div>
            <button
              onClick={() => setShowTimeTravelPanel(false)}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-blue-700 hover:bg-blue-50"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {statusMessage && (
        <div className="absolute bottom-6 right-6 max-w-md bg-gray-900 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-30 text-right">
          {statusMessage}
        </div>
      )}

      {showComposeModal && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2 text-gray-800">
                <PenLine className="h-4 w-4" />
                <span className="text-sm font-semibold">New Message</span>
              </div>
              <button onClick={() => setShowComposeModal(false)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500" title="Close compose">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <input
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="To"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <input
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Subject"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                rows={8}
                placeholder="Write your message"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none"
              />
            </div>
            <div className="px-4 pb-4 flex items-center justify-between">
              <button onClick={sendCompose} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-full shadow-sm">Send</button>
              <button onClick={() => { setComposeTo(''); setComposeSubject(''); setComposeBody(''); }} className="text-sm text-gray-600 hover:text-gray-800">Discard draft</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
