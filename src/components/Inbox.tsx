import React, { useState, useMemo } from 'react';
import { MockEmail } from '../services/mockData';
import { format } from 'date-fns';
import { Star, MoreVertical, Clock, CheckCircle, RotateCw, ChevronLeft, ChevronRight, Inbox as InboxIcon, Tag, Users, Info, Square, FileText, CheckSquare, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface InboxProps {
  folder: string;
  emails: MockEmail[];
  onUpdateEmail: (id: string, updates: Partial<MockEmail>) => void;
  onDeleteEmails: (ids: Set<string>) => void;
  onStartReview: () => void;
}

export function Inbox({ folder, emails, onUpdateEmail, onDeleteEmails, onStartReview }: InboxProps) {
  const [showBanner, setShowBanner] = useState(true);
  const [activeTab, setActiveTab] = useState('primary');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const displayedEmails = useMemo(() => {
    if (folder === 'starred') return emails.filter(e => e.starred);
    if (folder === 'snoozed') return [];
    if (folder === 'sent') return [];
    if (folder === 'drafts') return [];
    
    // Inbox tabs filtering
    if (activeTab === 'promotions') return emails.filter(e => e.category === 'promotions' || (!e.category && (e.sender.includes('AJIO') || e.sender.includes('Swiggy'))));
    if (activeTab === 'updates') return emails.filter(e => e.category === 'updates' || (!e.category && (e.sender.includes('HDFC') || e.sender.includes('Zerodha'))));
    if (activeTab === 'social') return emails.filter(e => e.category === 'social');
    
    // Primary tab
    return emails.filter(e => e.category === 'primary' || (!e.category && !e.sender.includes('AJIO') && !e.sender.includes('Swiggy') && !e.sender.includes('HDFC') && !e.sender.includes('Zerodha')));
  }, [emails, folder, activeTab]);

  const toggleSelectAll = () => {
    if (selectedIds.size === displayedEmails.length && displayedEmails.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedEmails.map(e => e.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const newPromotionsCount = useMemo(() => emails.filter(e => e.unread && (e.category === 'promotions' || (!e.category && (e.sender.includes('AJIO') || e.sender.includes('Swiggy'))))).length, [emails]);
  const newSocialCount = useMemo(() => emails.filter(e => e.unread && e.category === 'social').length, [emails]);
  const newUpdatesCount = useMemo(() => emails.filter(e => e.unread && (e.category === 'updates' || (!e.category && (e.sender.includes('HDFC') || e.sender.includes('Zerodha'))))).length, [emails]);

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

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-4">
          <button onClick={toggleSelectAll} className="p-2 hover:bg-gray-100 rounded text-gray-600">
            {selectedIds.size > 0 && selectedIds.size === displayedEmails.length ? (
              <CheckSquare className="h-4 w-4 text-blue-600" />
            ) : selectedIds.size > 0 ? (
              <div className="relative h-4 w-4 flex items-center justify-center border border-gray-400 rounded-sm">
                <div className="w-2 h-0.5 bg-gray-600"></div>
              </div>
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
          <button className="p-2 hover:bg-gray-100 rounded text-gray-600">
            <RotateCw className="h-4 w-4" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded text-gray-600">
            <MoreVertical className="h-4 w-4" />
          </button>
          
          {selectedIds.size > 0 && (
            <div className="flex items-center ml-4 pl-4 border-l border-gray-200">
              <button onClick={handleDelete} className="p-2 hover:bg-gray-100 rounded text-gray-600" title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{displayedEmails.length > 0 ? `1-${displayedEmails.length} of ${displayedEmails.length}` : '0 of 0'}</span>
          <div className="flex items-center gap-1">
            <button className="p-2 hover:bg-gray-100 rounded text-gray-400">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded text-gray-600">
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
            onClick={() => { setActiveTab('social'); setSelectedIds(new Set()); }}
            className={cn("flex items-center gap-4 px-6 py-4 text-sm font-medium border-b-2 transition-colors", activeTab === 'social' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:bg-gray-50')}
          >
            <Users className="h-5 w-5" />
            Social
            {newSocialCount > 0 && (
              <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{newSocialCount} new</span>
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
          {showBanner && folder === 'inbox' && activeTab === 'primary' && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
              className="bg-blue-50 border-b border-blue-100 p-4 flex items-center justify-between shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="bg-blue-100 p-2 rounded-full text-blue-600 mt-1">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-blue-900">Your Weekly Inbox Review is Ready</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Review {emails.length} conversations from the past week
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowBanner(false)}
                  className="px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 rounded-md transition-colors"
                >
                  Dismiss
                </button>
                <button 
                  onClick={() => setShowBanner(false)}
                  className="px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 rounded-md transition-colors flex items-center gap-2"
                >
                  <Clock className="h-4 w-4" />
                  Snooze
                </button>
                <button 
                  onClick={onStartReview}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors"
                >
                  Start Review
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
            displayedEmails.map((email) => (
              <div 
                key={email.id} 
                onClick={() => markAsRead(email.id)}
                className={cn("flex flex-col px-4 py-2 hover:shadow-[inset_1px_0_0_#dadce0,inset_-1px_0_0_#dadce0,0_1px_2px_0_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)] cursor-pointer group transition-shadow", email.unread ? 'bg-white font-semibold text-gray-900' : 'bg-gray-50/50 text-gray-600', selectedIds.has(email.id) ? 'bg-blue-50/30' : '')}
              >
                <div className="flex items-center">
                  <div className="flex items-center gap-3 w-64 flex-shrink-0">
                    <button onClick={(e) => toggleSelect(email.id, e)} className="p-1 hover:bg-gray-200 rounded text-gray-400 opacity-20 group-hover:opacity-100 transition-opacity">
                      {selectedIds.has(email.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4" />}
                    </button>
                    <button onClick={(e) => toggleStar(email.id, !!email.starred, e)} className="p-1 hover:bg-gray-200 rounded">
                      <Star className={cn("h-4 w-4", email.starred ? "text-yellow-400 fill-yellow-400" : "text-gray-300 hover:text-yellow-400")} />
                    </button>
                    <span className="truncate text-sm">{email.sender}</span>
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-2 text-sm">
                    <span className="truncate">{email.subject}</span>
                    <span className="text-gray-500 font-normal truncate">- {email.snippet}</span>
                  </div>
                  <div className="w-24 text-right text-xs font-medium flex-shrink-0">
                    {format(new Date(email.date), 'HH:mm').replace(/^0/, '')}
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
    </div>
  );
}
