import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Loader2,
  AlertCircle,
  MessageSquare,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Calendar,
  Clock,
  ArrowRightCircle,
  X,
  Reply,
  Forward,
  ListTodo,
  PartyPopper,
  Send,
  CalendarCheck,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { extractWeeklyReviewData, ExtractedAction, WeeklyReviewData } from '../services/geminiService';
import { MockEmail } from '../services/mockData';

interface WeeklyReviewProps {
  emails: MockEmail[];
  initialCarryForwardIds?: string[];
  onComplete: (result: ReviewCompletionResult) => void;
}

export interface ReviewCompletionResult {
  carryForwardThreadIds: string[];
  summary: {
    resolved: number;
    carried: number;
    snoozed: number;
    dismissed: number;
  };
}

type ReviewStep = 'digest' | 'actions' | 'followup' | 'complete';
type ActionStatus = 'pending' | 'resolved' | 'carry-forward' | 'snoozed' | 'dismissed';
type QuickResolveMode = 'reply' | 'delegate' | 'schedule' | 'task' | null;
type ReviewAction = Omit<ExtractedAction, 'status'> & {
  status: ActionStatus;
  snoozeDate?: string;
  carriedIn?: boolean;
};

const urgencyColors = {
  Critical: 'bg-red-100 text-red-800 border-red-200',
  High: 'bg-orange-100 text-orange-800 border-orange-200',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Low: 'bg-green-100 text-green-800 border-green-200',
};

export function WeeklyReview({ emails, onComplete, initialCarryForwardIds = [] }: WeeklyReviewProps) {
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
  const [quickRecipient, setQuickRecipient] = useState('');
  const [quickDateTime, setQuickDateTime] = useState('');
  const [saving, setSaving] = useState(false);

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 7);
  const dateRangeStr = `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`;

  useEffect(() => {
    async function run() {
      try {
        setLoading(true);
        const result = await extractWeeklyReviewData(emails);
        setData(result);
        const carryForwardSet = new Set(initialCarryForwardIds);
        const hydratedActions = result.actions.map((action) => ({
            ...action,
            status:
              action.status === 'Resolved'
                ? 'resolved'
                : action.status === 'CarryForward'
                  ? 'carry-forward'
                  : action.status === 'Snoozed'
                    ? 'snoozed'
                    : action.status === 'Dismissed'
                      ? 'dismissed'
                      : 'pending',
            carriedIn: carryForwardSet.has(action.threadId),
          } as ReviewAction));

        const existingThreadIds = new Set(hydratedActions.map((action) => action.threadId));
        for (const threadId of initialCarryForwardIds) {
          if (existingThreadIds.has(threadId)) {
            continue;
          }

          const email = emails.find((item) => item.id === threadId);
          if (!email) {
            continue;
          }

          hydratedActions.push({
            threadId,
            summary: `Follow up carried from last review: ${email.subject}`,
            urgency: 'High',
            confidence: 65,
            status: 'pending',
            carriedIn: true,
          });
        }

        setActions(hydratedActions);
      } catch (e) {
        console.error(e);
        setError('Failed to generate weekly review. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [emails, initialCarryForwardIds]);

  const pendingActions = useMemo(() => actions.filter((a) => a.status === 'pending'), [actions]);
  const carriedInCount = useMemo(() => actions.filter((a) => a.carriedIn).length, [actions]);
  const sortedActions = useMemo(() => {
    const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return [...actions].sort((a, b) => order[a.urgency] - order[b.urgency]);
  }, [actions]);

  const summary = useMemo(
    () =>
      actions.reduce(
        (acc, action) => {
          if (action.status === 'resolved') acc.resolved += 1;
          if (action.status === 'carry-forward') acc.carried += 1;
          if (action.status === 'snoozed') acc.snoozed += 1;
          if (action.status === 'dismissed') acc.dismissed += 1;
          return acc;
        },
        { resolved: 0, carried: 0, snoozed: 0, dismissed: 0 }
      ),
    [actions]
  );

  const setActionStatus = (threadId: string, status: ActionStatus) => {
    setActions((prev) => prev.map((action) => (action.threadId === threadId ? { ...action, status } : action)));
  };

  const setActionUrgency = (threadId: string, urgency: string) => {
    setActions((prev) => prev.map((action) => (action.threadId === threadId ? { ...action, urgency: urgency as any } : action)));
  };

  const setActionSnooze = (threadId: string, snoozeDate: string) => {
    setActions((prev) => prev.map((action) => (action.threadId === threadId ? { ...action, status: 'snoozed', snoozeDate } : action)));
  };

  const toggleActionSource = (threadId: string) => {
    setExpandedActions((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  };

  const toggleTheme = (title: string) => {
    setExpandedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const closeReview = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 450));
    const carryForwardThreadIds = actions
      .filter((action) => action.status === 'carry-forward')
      .map((action) => action.threadId);

    const result: ReviewCompletionResult = {
      carryForwardThreadIds,
      summary,
    };

    setSaving(false);
    onComplete(result);
  };

  const openQuickResolve = (action: ReviewAction, mode: Exclude<QuickResolveMode, null>) => {
    const email = emails.find((item) => item.id === action.threadId);
    setQuickResolveActionId(action.threadId);
    setQuickResolveMode(mode);
    setQuickNote(`About: ${action.summary}`);
    setQuickRecipient(email?.sender || '');
    setQuickDateTime('');
  };

  const closeQuickResolve = () => {
    setQuickResolveActionId(null);
    setQuickResolveMode(null);
    setQuickNote('');
    setQuickRecipient('');
    setQuickDateTime('');
  };

  const submitQuickResolve = (action: ReviewAction) => {
    if (!quickResolveMode) {
      return;
    }

    if (quickResolveMode === 'schedule') {
      setActionSnooze(action.threadId, quickDateTime || 'scheduled-later');
    } else if (quickResolveMode === 'delegate') {
      setActionStatus(action.threadId, 'carry-forward');
    } else {
      setActionStatus(action.threadId, 'resolved');
    }

    closeQuickResolve();
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
          <p className="text-gray-700">{error || 'Could not load weekly review.'}</p>
          <button
            onClick={() =>
              onComplete({
                carryForwardThreadIds: initialCarryForwardIds,
                summary: { resolved: 0, carried: initialCarryForwardIds.length, snoozed: 0, dismissed: 0 },
              })
            }
            className="mt-4 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
          >
            Return to Inbox
          </button>
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
            <p className="text-sm text-gray-500 mt-1">{dateRangeStr} • {emails.length} conversations analyzed • {carriedInCount} carried in</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep('digest')} className={cn('px-3 py-2 rounded-full text-sm', step === 'digest' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600')}>Digest</button>
            <button onClick={() => setStep('actions')} className={cn('px-3 py-2 rounded-full text-sm', step === 'actions' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600')}>Actions</button>
            <button onClick={() => setStep('followup')} className={cn('px-3 py-2 rounded-full text-sm', step === 'followup' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600')}>Follow-up</button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          {step === 'digest' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-gray-400" />
                Key Themes
              </h2>
              {carriedInCount > 0 && (
                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  {carriedInCount} item{carriedInCount > 1 ? 's' : ''} carried forward from your previous review.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.themes.map((theme) => (
                  <div key={theme.title} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <button onClick={() => toggleTheme(theme.title)} className="w-full p-4 text-left hover:bg-gray-50 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{theme.title}</h3>
                          {theme.hasCriticalAction && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">Critical</span>}
                        </div>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{theme.summary}</p>
                        <p className="text-xs text-gray-500 mt-2">{theme.threadIds.length} threads</p>
                      </div>
                      {expandedThemes.has(theme.title) ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                    </button>
                    {expandedThemes.has(theme.title) && (
                      <div className="border-t border-gray-100 bg-gray-50 p-4">
                        {theme.threadIds.map((id) => {
                          const email = emails.find((e) => e.id === id);
                          if (!email) return null;
                          return (
                            <div key={id} className="text-sm text-gray-700 mb-1">
                              <span className="font-medium">{email.sender}:</span> {email.subject}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => setStep('actions')} className="mt-5 px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm">
                View Action Items
              </button>
            </div>
          )}

          {step === 'actions' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-gray-400" />
                Prioritized Actions ({pendingActions.length} pending)
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {sortedActions.map((action) => {
                  const email = emails.find((e) => e.id === action.threadId);
                  const resolved = action.status !== 'pending';
                  return (
                    <div key={action.threadId} className={cn('p-4', resolved && 'opacity-60 bg-gray-50')}>
                      <div className="flex items-start gap-3">
                        <button onClick={() => setActionStatus(action.threadId, resolved ? 'pending' : 'resolved')} className={cn('h-5 w-5 border rounded mt-1', resolved ? 'bg-blue-500 border-blue-500' : 'border-gray-300')}>
                          {resolved ? <CheckSquare className="h-4 w-4 text-white" /> : null}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <select value={action.urgency} onChange={(e) => setActionUrgency(action.threadId, e.target.value)} className={cn('text-xs px-2 py-1 rounded-full border', urgencyColors[action.urgency])} disabled={resolved}>
                              <option value="Critical">Critical</option>
                              <option value="High">High</option>
                              <option value="Medium">Medium</option>
                              <option value="Low">Low</option>
                            </select>
                            {action.dueDate && (
                              <span className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="h-3 w-3" />Due: {format(new Date(action.dueDate), 'MMM d')}</span>
                            )}
                            {action.carriedIn && (
                              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">Carried In</span>
                            )}
                            <span className="text-xs text-gray-400 ml-auto">AI Confidence: {action.confidence}%</span>
                          </div>
                          <p className={cn('text-sm font-medium', resolved && 'line-through text-gray-500')}>{action.summary}</p>
                          {email && (
                            <div className="mt-1 text-xs text-gray-500">
                              <span className="font-medium text-gray-700">{email.sender}</span> • {email.subject}
                              <button onClick={() => toggleActionSource(action.threadId)} className="ml-2 text-blue-600 hover:underline">{expandedActions.has(action.threadId) ? 'Hide Source' : 'View Source'}</button>
                            </div>
                          )}
                          {expandedActions.has(action.threadId) && email && (
                            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                              {email.messages[0]?.body || email.snippet}
                            </div>
                          )}
                          {!resolved && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button onClick={() => openQuickResolve(action, 'reply')} className="px-3 py-1.5 text-xs border border-gray-300 rounded flex items-center gap-1 hover:bg-gray-50"><Reply className="h-3.5 w-3.5" />Reply Inline</button>
                              <button onClick={() => openQuickResolve(action, 'delegate')} className="px-3 py-1.5 text-xs border border-gray-300 rounded flex items-center gap-1 hover:bg-gray-50"><Forward className="h-3.5 w-3.5" />Delegate</button>
                              <button onClick={() => openQuickResolve(action, 'schedule')} className="px-3 py-1.5 text-xs border border-gray-300 rounded flex items-center gap-1 hover:bg-gray-50"><Calendar className="h-3.5 w-3.5" />Schedule</button>
                              <button onClick={() => openQuickResolve(action, 'task')} className="px-3 py-1.5 text-xs border border-gray-300 rounded flex items-center gap-1 hover:bg-gray-50"><ListTodo className="h-3.5 w-3.5" />Add to Tasks</button>
                            </div>
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
                                  <textarea
                                    value={quickNote}
                                    onChange={(e) => setQuickNote(e.target.value)}
                                    className="w-full rounded-md border border-blue-200 bg-white px-2 py-1 text-xs text-gray-700 resize-none"
                                    rows={3}
                                  />
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
                                </>
                              )}
                              <div className="flex items-center gap-2">
                                <button onClick={() => submitQuickResolve(action)} className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700">
                                  {quickResolveMode === 'schedule' ? <CalendarCheck className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                                  Confirm
                                </button>
                                <button onClick={closeQuickResolve} className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setStep('followup')} className="mt-5 px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm">
                Follow-up Tracker
              </button>
            </div>
          )}

          {step === 'followup' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <ArrowRightCircle className="h-5 w-5 text-gray-400" />
                Follow-up Decisions
              </h2>
              <div className="space-y-3">
                {pendingActions.map((action) => (
                  <div key={action.threadId} className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-sm font-medium text-gray-900 mb-3">{action.summary}</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setActionStatus(action.threadId, 'carry-forward')} className="px-3 py-1.5 text-xs border border-gray-300 rounded-full flex items-center gap-1 hover:bg-gray-50"><ArrowRightCircle className="h-3.5 w-3.5" />Carry Forward</button>
                      <button onClick={() => setActionSnooze(action.threadId, 'next-week')} className="px-3 py-1.5 text-xs border border-gray-300 rounded-full flex items-center gap-1 hover:bg-gray-50"><Clock className="h-3.5 w-3.5" />Snooze</button>
                      <button onClick={() => setActionStatus(action.threadId, 'dismissed')} className="px-3 py-1.5 text-xs border border-gray-300 rounded-full text-red-600 flex items-center gap-1 hover:bg-gray-50"><X className="h-3.5 w-3.5" />Dismiss</button>
                    </div>
                  </div>
                ))}
              </div>
              {pendingActions.length > 0 && (
                <button onClick={() => pendingActions.forEach((action) => setActionStatus(action.threadId, 'carry-forward'))} className="mt-4 px-4 py-2 text-sm border border-gray-300 rounded-full hover:bg-gray-50">
                  Carry Forward All Pending
                </button>
              )}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button onClick={() => setStep('complete')} disabled={pendingActions.length > 0} className="w-full px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-full text-sm font-medium">
                  Complete Weekly Review
                </button>
                {pendingActions.length > 0 && <p className="mt-2 text-xs text-gray-500 text-center">All pending items need a decision before completion.</p>}
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <PartyPopper className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">Weekly Review Complete</h2>
              <p className="text-sm text-gray-500 mt-1">Closure summary for {dateRangeStr}</p>
              <div className="grid grid-cols-2 gap-3 mt-6 text-left">
                <StatCard label="Resolved" value={summary.resolved} color="text-green-600" />
                <StatCard label="Carry Forward" value={summary.carried} color="text-blue-600" />
                <StatCard label="Snoozed" value={summary.snoozed} color="text-orange-600" />
                <StatCard label="Dismissed" value={summary.dismissed} color="text-gray-600" />
              </div>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button onClick={() => setStep('digest')} className="px-4 py-2 text-sm border border-gray-300 rounded-full hover:bg-gray-50">Review Again</button>
                <button onClick={closeReview} disabled={saving} className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-full disabled:opacity-50 flex items-center gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Saving...' : 'Return to Inbox'}
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
