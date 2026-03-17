import React, { useState, useEffect } from 'react';
import { extractWeeklyReviewData, WeeklyReviewData, ExtractedAction } from '../services/geminiService';
import { MockEmail } from '../services/mockData';
import { Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Calendar, Clock, MessageSquare, CheckSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface WeeklyReviewProps {
  emails: MockEmail[];
  onComplete: () => void;
}

export function WeeklyReview({ emails, onComplete }: WeeklyReviewProps) {
  const [data, setData] = useState<WeeklyReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
  const [actions, setActions] = useState<ExtractedAction[]>([]);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Calculate the date range for the past week
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 7);
  const dateRangeStr = `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`;

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const result = await extractWeeklyReviewData(emails);
        setData(result);
        setActions(result.actions);
      } catch (err) {
        console.error(err);
        setError("Failed to generate weekly review. Please check your API key.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [emails]);

  const handleComplete = async () => {
    if (!auth.currentUser || !data) return;
    
    setSaving(true);
    try {
      // Save review session
      const reviewRef = await addDoc(collection(db, 'weeklyReviews'), {
        userId: auth.currentUser.uid,
        periodStart: new Date('2026-03-08T00:00:00Z'),
        periodEnd: new Date('2026-03-14T23:59:59Z'),
        status: 'Completed',
        createdAt: serverTimestamp()
      });

      // Save themes
      for (const theme of data.themes) {
        await addDoc(collection(db, 'themeClusters'), {
          reviewId: reviewRef.id,
          userId: auth.currentUser.uid,
          title: theme.title,
          summary: theme.summary,
          threadIds: theme.threadIds,
          hasCriticalAction: theme.hasCriticalAction
        });
      }

      // Save actions
      for (const action of actions) {
        await addDoc(collection(db, 'actionItems'), {
          reviewId: reviewRef.id,
          userId: auth.currentUser.uid,
          threadId: action.threadId,
          summary: action.summary,
          urgency: action.urgency,
          status: action.status || 'Pending',
          confidence: action.confidence
        });
      }

      onComplete();
    } catch (err) {
      console.error("Error saving review to Firestore:", err);
      alert("Failed to save review. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleTheme = (title: string) => {
    const newSet = new Set(expandedThemes);
    if (newSet.has(title)) {
      newSet.delete(title);
    } else {
      newSet.add(title);
    }
    setExpandedThemes(newSet);
  };

  const updateActionStatus = (threadId: string, newStatus: string) => {
    setActions(prev => prev.map(a => a.threadId === threadId ? { ...a, status: newStatus as any } : a));
  };

  const updateActionUrgency = (threadId: string, newUrgency: string) => {
    setActions(prev => prev.map(a => a.threadId === threadId ? { ...a, urgency: newUrgency as any } : a));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50">
        <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
        <h2 className="text-xl font-medium text-gray-800">Analyzing your week...</h2>
        <p className="text-gray-500 mt-2">Extracting themes and prioritizing actions with Gemini 3.1 Pro</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-8">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-medium text-gray-800">Oops, something went wrong</h2>
        <p className="text-gray-500 mt-2 text-center max-w-md">{error}</p>
        <button 
          onClick={onComplete}
          className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Return to Inbox
        </button>
      </div>
    );
  }

  const pendingActions = actions.filter(a => a.status !== 'Resolved' && a.status !== 'Dismissed' && a.status !== 'CarryForward');
  const resolvedActions = actions.filter(a => a.status === 'Resolved');

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 shadow-sm z-10">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Weekly Review</h1>
            <p className="text-gray-500 mt-1">{dateRangeStr} • {emails.length} conversations analyzed</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{pendingActions.length}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Pending</div>
            </div>
            <div className="h-10 w-px bg-gray-200"></div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">{resolvedActions.length}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Resolved</div>
            </div>
            <button 
              onClick={() => setShowCompletionModal(true)}
              className="ml-6 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
            >
              Complete Review
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          
          {/* Themes Section */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-gray-400" />
              Key Themes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data?.themes.map((theme, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div 
                    className="p-5 cursor-pointer hover:bg-gray-50 transition-colors flex items-start justify-between"
                    onClick={() => toggleTheme(theme.title)}
                  >
                    <div className="pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900">{theme.title}</h3>
                        {theme.hasCriticalAction && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Critical Action
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2">{theme.summary}</p>
                    </div>
                    <div className="flex items-center gap-3 text-gray-400">
                      <div className="text-xs font-medium bg-gray-100 px-2 py-1 rounded-full">
                        {theme.threadIds.length} threads
                      </div>
                      {expandedThemes.has(theme.title) ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {expandedThemes.has(theme.title) && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-100 bg-gray-50 px-5 py-3"
                      >
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Source Threads</p>
                        <ul className="space-y-2">
                          {theme.threadIds.map(id => {
                            const email = emails.find(e => e.id === id);
                            return email ? (
                              <li key={id} className="text-sm text-gray-700 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                                <span className="font-medium">{email.sender}:</span> {email.subject}
                              </li>
                            ) : null;
                          })}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </section>

          {/* Actions Section */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-gray-400" />
              Prioritized Actions
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
              {actions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No pending actions identified.</div>
              ) : (
                actions.sort((a, b) => {
                  const urgencyOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
                  return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
                }).map((action) => (
                  <ActionRow 
                    key={action.threadId} 
                    action={action} 
                    emails={emails}
                    onStatusChange={(status) => updateActionStatus(action.threadId, status)}
                    onUrgencyChange={(urgency) => updateActionUrgency(action.threadId, urgency)}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Completion Modal */}
      <AnimatePresence>
        {showCompletionModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <h2 className="text-xl font-semibold text-gray-900">Complete Weekly Review</h2>
                <button onClick={() => setShowCompletionModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Unresolved Actions</h3>
                  <p className="text-sm text-gray-500">
                    You have {pendingActions.length} unresolved actions. Decide how to handle them before closing the week.
                  </p>
                </div>

                {pendingActions.length > 0 ? (
                  <div className="space-y-3">
                    {pendingActions.map(action => (
                      <div key={action.threadId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1 pr-4">
                          <p className="text-sm font-medium text-gray-900 line-clamp-1">{action.summary}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => updateActionStatus(action.threadId, 'CarryForward')}
                            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 text-gray-700"
                          >
                            Carry Forward
                          </button>
                          <button 
                            onClick={() => updateActionStatus(action.threadId, 'Dismissed')}
                            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 text-red-600"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-green-50 rounded-xl border border-green-100">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-green-900">All caught up!</h3>
                    <p className="text-sm text-green-700 mt-1">You've resolved all actions for this week.</p>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                <button 
                  onClick={() => setShowCompletionModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleComplete}
                  disabled={pendingActions.length > 0 || saving}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Saving...' : 'Confirm & Close Week'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ActionRowProps {
  action: ExtractedAction;
  emails: MockEmail[];
  onStatusChange: (s: string) => void;
  onUrgencyChange: (u: string) => void;
}

const ActionRow: React.FC<ActionRowProps> = ({ action, emails, onStatusChange, onUrgencyChange }) => {
  const email = emails.find(e => e.id === action.threadId);
  const [expanded, setExpanded] = useState(false);

  const urgencyColors = {
    Critical: 'bg-red-100 text-red-800 border-red-200',
    High: 'bg-orange-100 text-orange-800 border-orange-200',
    Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Low: 'bg-green-100 text-green-800 border-green-200',
  };

  const isResolved = action.status === 'Resolved' || action.status === 'Dismissed' || action.status === 'CarryForward';

  return (
    <div className={cn("transition-colors", isResolved ? "bg-gray-50 opacity-60" : "bg-white hover:bg-gray-50")}>
      <div className="p-4 flex items-start gap-4">
        <div className="pt-1">
          <button 
            onClick={() => onStatusChange(isResolved ? 'Pending' : 'Resolved')}
            className={cn(
              "h-5 w-5 rounded border flex items-center justify-center transition-colors",
              isResolved ? "bg-blue-500 border-blue-500 text-white" : "border-gray-300 hover:border-blue-500"
            )}
          >
            {isResolved && <CheckSquare className="h-3.5 w-3.5" />}
          </button>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <select 
              value={action.urgency}
              onChange={(e) => onUrgencyChange(e.target.value)}
              className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full border appearance-none cursor-pointer outline-none",
                urgencyColors[action.urgency]
              )}
              disabled={isResolved}
            >
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            {action.dueDate && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Due: {format(new Date(action.dueDate), 'MMM d')}
              </span>
            )}
            <span className="text-xs text-gray-400 ml-auto flex items-center gap-1" title="AI Confidence Score">
              AI Confidence: {action.confidence}%
            </span>
          </div>
          
          <h4 className={cn("text-sm font-medium text-gray-900 mb-1", isResolved && "line-through text-gray-500")}>
            {action.summary}
          </h4>
          
          {email && (
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span className="font-medium text-gray-700">{email.sender}</span>
              <span>•</span>
              <span className="truncate">{email.subject}</span>
              <button 
                onClick={() => setExpanded(!expanded)}
                className="ml-2 text-blue-600 hover:underline font-medium"
              >
                {expanded ? 'Hide Source' : 'View Source'}
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && email && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-4 pl-14"
          >
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-sm text-gray-700">
              <div className="font-medium mb-2 border-b border-gray-200 pb-2">
                {email.subject}
              </div>
              <p className="whitespace-pre-wrap">{email.messages[0].body}</p>
            </div>
            
            {!isResolved && (
              <div className="flex items-center gap-2 mt-3">
                <button className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 text-gray-700">
                  Reply Inline
                </button>
                <button className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 text-gray-700">
                  Delegate
                </button>
                <button className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 text-gray-700">
                  Add to Tasks
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
