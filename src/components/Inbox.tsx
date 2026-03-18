import React, { useEffect, useMemo, useState } from 'react';
import { MockEmail } from '../services/mockData';
import { format } from 'date-fns';
import { Star, MoreVertical, Clock, CheckCircle, RotateCw, ChevronLeft, ChevronRight, Inbox as InboxIcon, Tag, Info, Square, FileText, CheckSquare, Trash2, X, Reply, Forward, Archive, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const bannerGhostButtonClass = 'rounded-md px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100';
const bannerPrimaryButtonClass = 'rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700';
const hiddenBannerButtonClass = 'px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 rounded-md transition-colors';

const formatInboxDateLabel = (isoDate: string): string => {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const now = new Date();
  const isSameDay =
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate();

  if (isSameDay) {
    return format(parsed, 'h:mm a');
  }

  return parsed.getFullYear() === now.getFullYear() ? format(parsed, 'MMM d') : format(parsed, 'MMM d, yyyy');
};

const extractSenderName = (sender: string): string => {
  const bracketMatch = sender.match(/^\s*([^<]+?)\s*<[^>]+>\s*$/);
  if (bracketMatch) {
    return bracketMatch[1].trim();
  }
  return sender.trim();
};

const extractSenderEmail = (sender: string): string | null => {
  const bracketMatch = sender.match(/<([^>]+)>/);
  if (bracketMatch?.[1]) {
    return bracketMatch[1].trim();
  }

  const plainEmailMatch = sender.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return plainEmailMatch?.[0] ?? null;
};

const getSenderDisplay = (sender: string): string => {
  const name = extractSenderName(sender);
  const email = extractSenderEmail(sender);

  // If sender is in "Name <email>" format, show only the name in inbox rows.
  if (email && name !== email) {
    return name;
  }

  return email ?? name;
};

const getInitials = (sender: string): string => {
  const display = getSenderDisplay(sender);
  const parts = display
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
};

const toInlineSnippet = (body: string): string => body.replace(/\s+/g, ' ').trim().slice(0, 170);

const getLatestThreadTimestamp = (email: MockEmail): number => {
  const baseTs = new Date(email.date).getTime();
  const threadLatestTs = email.messages.reduce((latest, message) => {
    const messageTs = new Date(message.date).getTime();
    if (Number.isNaN(messageTs)) {
      return latest;
    }
    return Math.max(latest, messageTs);
  }, Number.isNaN(baseTs) ? 0 : baseTs);

  return threadLatestTs;
};

interface InboxProps {
  folder: string;
  emails: MockEmail[];
  onUpdateEmail: (id: string, updates: Partial<MockEmail>) => void;
  onDeleteEmails: (ids: Set<string>) => void;
  onRefresh: () => Promise<void>;
  onStartReview: () => void;
  weeklyReviewReady: boolean;
  weeklyReviewWindowOpen: boolean;
  weeklyReviewSnoozed: boolean;
  weeklyReviewPrepared: boolean;
  weeklyReviewPreparing: boolean;
  weeklyReviewPeriodLabel: string;
  weeklyReviewPreview: string;
  weeklyReviewPreparedAt: string | null;
  weeklyReviewNewSincePrepared: number;
  reviewThreadToOpen?: string | null;
  onReviewThreadOpened?: () => void;
  showBackToReview?: boolean;
  onBackToReview?: () => void;
  onRefreshReviewSummary: () => void;
  onDismissReviewBanner: () => void;
  onSnoozeReviewBanner: () => void;
  onRestoreReviewBanner: () => void;
}

export function Inbox({
  folder,
  emails,
  onUpdateEmail,
  onDeleteEmails,
  onRefresh,
  onStartReview,
  weeklyReviewReady,
  weeklyReviewWindowOpen,
  weeklyReviewSnoozed,
  weeklyReviewPrepared,
  weeklyReviewPreparing,
  weeklyReviewPeriodLabel,
  weeklyReviewPreview,
  weeklyReviewPreparedAt,
  weeklyReviewNewSincePrepared,
  reviewThreadToOpen,
  onReviewThreadOpened,
  showBackToReview = false,
  onBackToReview,
  onRefreshReviewSummary,
  onDismissReviewBanner,
  onSnoozeReviewBanner,
  onRestoreReviewBanner,
}: InboxProps) {
  const preparedAtLabel = useMemo(() => {
    if (!weeklyReviewPreparedAt) return null;
    const parsed = new Date(weeklyReviewPreparedAt);
    if (Number.isNaN(parsed.getTime())) return null;
    return format(parsed, 'dd/MM/yyyy, HH:mm:ss');
  }, [weeklyReviewPreparedAt]);

  const [activeTab, setActiveTab] = useState('primary');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [openedEmail, setOpenedEmail] = useState<MockEmail | null>(null);
  const [openedMessageId, setOpenedMessageId] = useState<string | null>(null);

  const PAGE_SIZE = 12;

  const displayedEmails = useMemo(() => {
    let filtered: MockEmail[] = [];

    if (folder === 'starred') {
      filtered = emails.filter(e => e.starred);
    } else if (folder === 'snoozed') {
      filtered = [];
    } else if (folder === 'sent') {
      filtered = [];
    } else if (folder === 'drafts') {
      filtered = [];
    } else if (folder === 'purchases') {
      filtered = emails;
    } else if (activeTab === 'promotions') {
      filtered = emails.filter(e => e.category === 'promotions' || (!e.category && (e.sender.includes('AJIO') || e.sender.includes('Swiggy'))));
    } else if (activeTab === 'updates') {
      filtered = emails.filter(
        (e) =>
          e.category === 'updates' ||
          e.category === 'social' ||
          (!e.category && (e.sender.includes('HDFC') || e.sender.includes('Zerodha')))
      );
    } else {
      // Primary tab
      filtered = emails.filter(e => e.category === 'primary' || (!e.category && !e.sender.includes('AJIO') && !e.sender.includes('Swiggy') && !e.sender.includes('HDFC') && !e.sender.includes('Zerodha')));
    }

    return [...filtered].sort((a, b) => getLatestThreadTimestamp(b) - getLatestThreadTimestamp(a));
  }, [emails, folder, activeTab]);

  const totalPages = Math.max(1, Math.ceil(displayedEmails.length / PAGE_SIZE));
  const pageEmails = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return displayedEmails.slice(start, end);
  }, [currentPage, displayedEmails]);

  const rangeStart = displayedEmails.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, displayedEmails.length);
  const pageIds = useMemo(() => pageEmails.map((email) => email.id), [pageEmails]);
  const allPageSelected = useMemo(() => pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id)), [pageIds, selectedIds]);
  const somePageSelected = useMemo(() => pageIds.some((id) => selectedIds.has(id)), [pageIds, selectedIds]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [folder, activeTab]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const toggleSelectAll = () => {
    if (pageIds.length === 0) {
      return;
    }

    const next = new Set(selectedIds);
    if (allPageSelected) {
      pageIds.forEach((id) => next.delete(id));
    } else {
      pageIds.forEach((id) => next.add(id));
    }

    setSelectedIds(next);
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const newPromotionsCount = useMemo(() => emails.filter(e => e.unread && (e.category === 'promotions' || (!e.category && (e.sender.includes('AJIO') || e.sender.includes('Swiggy'))))).length, [emails]);
  const newUpdatesCount = useMemo(
    () =>
      emails.filter(
        (e) =>
          e.unread &&
          (e.category === 'updates' || e.category === 'social' || (!e.category && (e.sender.includes('HDFC') || e.sender.includes('Zerodha'))))
      ).length,
    [emails]
  );

  const toggleStar = (id: string, currentStarred: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateEmail(id, { starred: !currentStarred });
  };

  const markAsRead = (id: string) => {
    onUpdateEmail(id, { unread: false });
  };

  const handleDelete = () => {
    onDeleteEmails(selectedIds);
    setSelectedIds(new Set());
  };

  const handleBulkMarkRead = () => {
    const targetIds = selectedIds.size > 0 ? Array.from(selectedIds) : pageIds;
    targetIds.forEach(id => onUpdateEmail(id, { unread: false }));
    setSelectedIds(new Set());
    setShowMoreActions(false);
  };

  const handleBulkMarkUnread = () => {
    const targetIds = selectedIds.size > 0 ? Array.from(selectedIds) : pageIds;
    targetIds.forEach(id => onUpdateEmail(id, { unread: true }));
    setSelectedIds(new Set());
    setShowMoreActions(false);
  };

  const openEmail = (email: MockEmail) => {
    markAsRead(email.id);
    setOpenedEmail({ ...email, unread: false });
    setOpenedMessageId(email.messages[email.messages.length - 1]?.id ?? null);
  };

  const closeEmail = () => {
    setOpenedEmail(null);
    setOpenedMessageId(null);
  };

  useEffect(() => {
    if (!reviewThreadToOpen || folder !== 'inbox') {
      return;
    }

    const target = emails.find((email) => email.id === reviewThreadToOpen);
    if (!target) {
      onReviewThreadOpened?.();
      return;
    }

    if (target.category === 'promotions') {
      setActiveTab('promotions');
    } else if (target.category === 'updates' || target.category === 'social') {
      setActiveTab('updates');
    } else {
      setActiveTab('primary');
    }

    markAsRead(target.id);
    setOpenedEmail({ ...target, unread: false });
    setOpenedMessageId(target.messages[target.messages.length - 1]?.id ?? null);
    onReviewThreadOpened?.();
  }, [emails, folder, onReviewThreadOpened, reviewThreadToOpen]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-4 relative">
          <button onClick={toggleSelectAll} className="p-2 hover:bg-gray-100 rounded text-gray-600">
            {allPageSelected ? (
              <CheckSquare className="h-4 w-4 text-blue-600" />
            ) : somePageSelected ? (
              <div className="relative h-4 w-4 flex items-center justify-center border border-gray-400 rounded-sm">
                <div className="w-2 h-0.5 bg-gray-600"></div>
              </div>
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
          <button onClick={onRefresh} className="p-2 hover:bg-gray-100 rounded text-gray-600" title="Refresh">
            <RotateCw className="h-4 w-4" />
          </button>
          <button onClick={() => setShowMoreActions(prev => !prev)} className="p-2 hover:bg-gray-100 rounded text-gray-600" title="More actions">
            <MoreVertical className="h-4 w-4" />
          </button>
          {showMoreActions && (
            <div className="absolute left-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-52 p-1">
              <button onClick={handleBulkMarkRead} disabled={selectedIds.size === 0 && pageIds.length === 0} className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 disabled:opacity-40">
                {selectedIds.size > 0 ? 'Mark selected as read' : 'Mark page as read'}
              </button>
              <button onClick={handleBulkMarkUnread} disabled={selectedIds.size === 0 && pageIds.length === 0} className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 disabled:opacity-40">
                {selectedIds.size > 0 ? 'Mark selected as unread' : 'Mark page as unread'}
              </button>
              <button onClick={handleDelete} disabled={selectedIds.size === 0} className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 text-red-600 disabled:opacity-40">Delete selected</button>
            </div>
          )}
          
          {selectedIds.size > 0 && (
            <div className="flex items-center ml-4 pl-4 border-l border-gray-200">
              <button onClick={handleDelete} className="p-2 hover:bg-gray-100 rounded text-gray-600" title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{displayedEmails.length > 0 ? `${rangeStart}-${rangeEnd} of ${displayedEmails.length}` : '0 of 0'}</span>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 hover:bg-gray-100 rounded text-gray-600 disabled:text-gray-300 disabled:hover:bg-transparent"
              title="Previous page"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || displayedEmails.length === 0}
              className="p-2 hover:bg-gray-100 rounded text-gray-600 disabled:text-gray-300 disabled:hover:bg-transparent"
              title="Next page"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs (only show in Inbox) */}
      {folder === 'inbox' && (
        <div className="flex items-center border-b border-gray-100 px-4">
          <button 
            onClick={() => { setActiveTab('primary'); setSelectedIds(new Set()); }}
            className={cn("flex items-center gap-4 px-6 py-4 text-sm font-medium border-b-2 transition-colors", activeTab === 'primary' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:bg-gray-50')}
          >
            <InboxIcon className="h-5 w-5" />
            Primary
          </button>
          <button 
            onClick={() => { setActiveTab('promotions'); setSelectedIds(new Set()); }}
            className={cn("flex items-center gap-4 px-6 py-4 text-sm font-medium border-b-2 transition-colors", activeTab === 'promotions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:bg-gray-50')}
          >
            <Tag className="h-5 w-5" />
            Promotions
            {newPromotionsCount > 0 && (
              <span className="bg-green-700 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{newPromotionsCount} new</span>
            )}
          </button>
          <button 
            onClick={() => { setActiveTab('updates'); setSelectedIds(new Set()); }}
            className={cn("flex items-center gap-4 px-6 py-4 text-sm font-medium border-b-2 transition-colors", activeTab === 'updates' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:bg-gray-50')}
          >
            <Info className="h-5 w-5" />
            Updates
            {newUpdatesCount > 0 && (
              <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{newUpdatesCount} new</span>
            )}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Trigger Banner */}
        <AnimatePresence>
          {weeklyReviewReady && folder === 'inbox' && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
              className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-blue-100/40 px-4 py-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                <div className="mt-0.5 rounded-full bg-blue-100 p-2 text-blue-600">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-blue-900">Your Weekly Inbox Review is Ready</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    {weeklyReviewPeriodLabel} • {weeklyReviewPreview}
                  </p>
                  {weeklyReviewPreparing && !weeklyReviewPrepared && (
                    <p className="mt-1 text-xs text-blue-600">Preparing detailed summary in the background. You can open now.</p>
                  )}
                  {preparedAtLabel && (
                    <p className="mt-1 text-xs text-blue-600">
                      Prepared at {preparedAtLabel}
                    </p>
                  )}
                  {weeklyReviewNewSincePrepared > 0 && (
                    <p className="mt-1 text-xs font-medium text-amber-700">
                      {weeklyReviewNewSincePrepared} new email{weeklyReviewNewSincePrepared > 1 ? 's' : ''} since summary
                    </p>
                  )}
                </div>
                </div>
              <div className="flex items-center gap-2">
                {weeklyReviewNewSincePrepared > 0 && (
                  <button
                    onClick={onRefreshReviewSummary}
                    className={bannerGhostButtonClass}
                  >
                    Refresh
                  </button>
                )}
                <button 
                  onClick={onDismissReviewBanner}
                  className={bannerGhostButtonClass}
                >
                  Dismiss
                </button>
                <button 
                  onClick={onSnoozeReviewBanner}
                  className={cn(bannerGhostButtonClass, 'flex items-center gap-2')}
                >
                  <Clock className="h-4 w-4" />
                  Snooze 2h
                </button>
                <button 
                  onClick={onStartReview}
                  className={bannerPrimaryButtonClass}
                >
                  Start Review
                </button>
              </div>
              </div>
            </motion.div>
          )}
          {!weeklyReviewReady && !weeklyReviewSnoozed && weeklyReviewWindowOpen && weeklyReviewPrepared && folder === 'inbox' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-gray-50 border-b border-gray-100 p-3 flex items-center justify-between"
            >
              <p className="text-xs text-gray-600">
                Weekly reminder hidden. You can restore it anytime.
                {weeklyReviewNewSincePrepared > 0 ? ` ${weeklyReviewNewSincePrepared} new email(s) since last summary.` : ''}
              </p>
              <div className="flex items-center gap-2">
                {weeklyReviewNewSincePrepared > 0 && (
                  <button
                    onClick={onRefreshReviewSummary}
                    className={hiddenBannerButtonClass}
                  >
                    Refresh Summary
                  </button>
                )}
                <button
                  onClick={onRestoreReviewBanner}
                  className={hiddenBannerButtonClass}
                >
                  Show Reminder
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Email List */}
        <div className="divide-y divide-gray-100">
          {displayedEmails.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No emails to display.
            </div>
          ) : (
            pageEmails.map((email) => (
              <div 
                key={email.id} 
                onClick={() => openEmail(email)}
                className={cn("flex flex-col px-4 py-2 hover:shadow-[inset_1px_0_0_#dadce0,inset_-1px_0_0_#dadce0,0_1px_2px_0_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)] cursor-pointer group transition-shadow", email.unread ? 'bg-white text-gray-900' : 'bg-gray-50/50 text-gray-700', selectedIds.has(email.id) ? 'bg-blue-50/30' : '')}
              >
                <div className="flex items-center">
                  <div className="flex items-center gap-3 w-[260px] flex-shrink-0">
                    <button onClick={(e) => toggleSelect(email.id, e)} className="p-1 hover:bg-gray-200 rounded text-gray-400 opacity-20 group-hover:opacity-100 transition-opacity">
                      {selectedIds.has(email.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4" />}
                    </button>
                    <button onClick={(e) => toggleStar(email.id, !!email.starred, e)} className="p-1 hover:bg-gray-200 rounded">
                      <Star className={cn("h-4 w-4", email.starred ? "text-yellow-400 fill-yellow-400" : "text-gray-300 hover:text-yellow-400")} />
                    </button>
                    <span className={cn('truncate text-sm', email.unread ? 'font-semibold text-gray-900' : 'font-normal text-gray-700')}>
                      {getSenderDisplay(email.sender)}
                      {email.messages.length > 1 && (
                        <span className="ml-1 text-xs text-gray-500 font-medium">({email.messages.length})</span>
                      )}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 flex items-center text-sm overflow-hidden">
                    <span className={cn('truncate max-w-[42%]', email.unread ? 'font-semibold text-gray-900' : 'font-normal text-gray-700')}>
                      {email.subject}
                    </span>
                    <span className="mx-2 text-gray-400 flex-shrink-0">-</span>
                    <span className="truncate text-gray-500 font-normal">{email.snippet}</span>
                  </div>
                  <div className={cn('w-24 text-right text-xs flex-shrink-0', email.unread ? 'font-semibold text-gray-700' : 'font-normal text-gray-500')}>
                    {formatInboxDateLabel(email.date)}
                  </div>
                </div>
                {email.attachments && email.attachments.length > 0 && (
                  <div className="flex items-center gap-2 mt-1 ml-64 pl-3">
                    {email.attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">
                        <FileText className="h-3.5 w-3.5 text-red-500" />
                        <span className="truncate max-w-[150px]">{att.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {openedEmail && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="absolute inset-0 z-20 bg-[#f6f8fc]"
          >
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-2">
                <div className="flex items-center gap-2">
                  {showBackToReview && onBackToReview && (
                    <button
                      onClick={() => {
                        closeEmail();
                        onBackToReview();
                      }}
                      className="px-3 py-1.5 rounded-md hover:bg-gray-100 text-gray-700 text-xs font-medium"
                      title="Back to weekly review"
                    >
                      Back to Review
                    </button>
                  )}
                  <button onClick={closeEmail} className="p-2 rounded-full hover:bg-gray-100 text-gray-600" title="Close message">
                    <X className="h-4 w-4" />
                  </button>
                  <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600" title="Archive">
                    <Archive className="h-4 w-4" />
                  </button>
                  <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600" title="Reply">
                    <Reply className="h-4 w-4" />
                  </button>
                  <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600" title="Forward">
                    <Forward className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  {format(new Date(openedEmail.date), 'EEE, MMM d, yyyy • h:mm a')}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-8 py-8">
                <div className="mx-auto max-w-5xl rounded-2xl border border-[#dadce0] bg-white shadow-sm">
                  <div className="border-b border-gray-200 px-8 py-6">
                    <div className="mb-4 flex items-center gap-3">
                      <h2 className="text-[40px] leading-tight font-normal text-[#202124]">{openedEmail.subject}</h2>
                      <span className="rounded bg-[#f1f3f4] px-2 py-0.5 text-xs text-[#5f6368]">Inbox</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e8eaed] text-sm font-semibold text-[#5f6368]">
                          {getInitials(openedEmail.sender)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#202124]">{getSenderDisplay(openedEmail.sender)}</p>
                          <p className="text-xs text-[#5f6368]">to me</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[#5f6368]">
                        <span className="text-xs">{format(new Date(openedEmail.date), 'EEE, MMM d, h:mm a')}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateEmail(openedEmail.id, { starred: !openedEmail.starred });
                            setOpenedEmail({ ...openedEmail, starred: !openedEmail.starred });
                          }}
                          className="p-1.5 rounded-full hover:bg-gray-100"
                          title="Star"
                        >
                          <Star className={cn('h-5 w-5', openedEmail.starred ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300')} />
                        </button>
                        <button className="p-1.5 rounded-full hover:bg-gray-100" title="Reply">
                          <Reply className="h-4 w-4" />
                        </button>
                        <button className="p-1.5 rounded-full hover:bg-gray-100" title="More options">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="px-8 py-6">
                    {openedEmail.messages.length === 1 ? (
                      <div className="rounded-xl border border-transparent bg-white px-2 py-1">
                        <p className="whitespace-pre-wrap text-[30px] leading-relaxed text-[#202124]">
                          {openedEmail.messages[0].body || openedEmail.snippet}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {openedEmail.messages.map((message) => {
                          const expanded = message.id === openedMessageId;
                          const senderDisplay = getSenderDisplay(message.sender);

                          return (
                            <div
                              key={message.id}
                              className={cn(
                                'rounded-xl border transition-colors',
                                expanded
                                  ? 'border-[#dadce0] bg-white shadow-[0_1px_2px_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)]'
                                  : 'border-[#e8eaed] bg-[#f8f9fa] hover:bg-[#f1f3f4]'
                              )}
                            >
                              <button
                                onClick={() => setOpenedMessageId(message.id)}
                                className="w-full px-4 py-3 text-left"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#e8eaed] text-xs font-semibold text-[#5f6368]">
                                      {getInitials(message.sender)}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-[#202124]">{senderDisplay}</p>
                                      {!expanded && (
                                        <p className="truncate text-xs text-[#5f6368]">{toInlineSnippet(message.body)}</p>
                                      )}
                                    </div>
                                  </div>
                                  <span className="flex-shrink-0 text-xs text-[#5f6368]">
                                    {format(new Date(message.date), 'EEE, MMM d, h:mm a')}
                                  </span>
                                </div>
                              </button>
                              {expanded && (
                                <div className="border-t border-[#eceff1] px-5 py-4">
                                  <p className="whitespace-pre-wrap text-[22px] leading-relaxed text-[#202124]">
                                    {message.body || openedEmail.snippet}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {openedEmail.attachments && openedEmail.attachments.length > 0 && (
                      <div className="mt-6">
                        <p className="mb-2 text-sm font-medium text-gray-800">Attachments</p>
                        <div className="flex flex-wrap gap-2">
                          {openedEmail.attachments.map((att, idx) => (
                            <button key={`${att.name}-${idx}`} className="inline-flex items-center gap-2 border border-gray-200 rounded-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                              <Paperclip className="h-3.5 w-3.5 text-gray-500" />
                              {att.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
