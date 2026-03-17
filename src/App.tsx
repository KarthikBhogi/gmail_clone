import React, { useEffect, useMemo, useState } from 'react';
import { Inbox } from './components/Inbox';
import { WeeklyReview } from './components/WeeklyReview';
import { Menu, Search, Settings, HelpCircle, Grid, Inbox as InboxIcon, Send, File, CheckSquare, Star, Clock, Tag, Plus, ChevronDown, X, PenLine } from 'lucide-react';
import { cn } from './lib/utils';
import { mockEmails as initialEmails, MockEmail } from './services/mockData';

export default function App() {
  type MailFolder = 'inbox' | 'starred' | 'snoozed' | 'sent' | 'drafts' | 'weekly-review' | 'purchases';

  const [fetchingEmails, setFetchingEmails] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<MailFolder>('inbox');
  const [emails, setEmails] = useState<MockEmail[]>(initialEmails);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAppsPanel, setShowAppsPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [labels, setLabels] = useState<{ name: string; color: string }[]>([]);

  const openExternal = (url: string, label: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    setStatusMessage(`Opened ${label}.`);
  };

  const handleUpdateEmail = (id: string, updates: Partial<MockEmail>) => {
    setEmails(emails.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const handleDeleteEmails = (ids: Set<string>) => {
    setEmails(emails.filter(e => !ids.has(e.id)));
  };

  const refreshEmails = async () => {
    setFetchingEmails(true);
    // Simulate inbox refresh in demo mode.
    await new Promise((resolve) => setTimeout(resolve, 450));
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
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gmail_icon_%282020%29.svg/512px-Gmail_icon_%282020%29.svg.png" alt="Gmail" className="h-8 w-8" />
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
            <button
              onClick={() => setShowSettingsPanel(prev => !prev)}
              className="p-1 hover:bg-gray-200 rounded-full text-gray-600"
              title="Search options"
            >
              <Settings className="h-5 w-5" />
            </button>
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
            onClick={() => setShowSettingsPanel(prev => !prev)}
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
                  {!sidebarCollapsed && 'Weekly Review'}
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
              <WeeklyReview emails={filteredEmails} onComplete={() => setCurrentFolder('inbox')} />
          ) : (
            <Inbox 
              folder={currentFolder} 
              emails={currentFolder === 'purchases' ? filteredEmails.filter(email => email.category === 'promotions') : filteredEmails}
              onUpdateEmail={handleUpdateEmail}
              onDeleteEmails={handleDeleteEmails}
              onRefresh={refreshEmails}
              onStartReview={() => setCurrentFolder('weekly-review')} 
            />
          )}
        </main>

        {/* Right Sidebar */}
        <aside className="w-14 flex-shrink-0 bg-white flex flex-col items-center py-4 gap-6 border-l border-gray-100">
          <button onClick={() => openExternal('https://calendar.google.com', 'Google Calendar')} className="p-2 hover:bg-gray-100 rounded-full" title="Calendar">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/512px-Google_Calendar_icon_%282020%29.svg.png" alt="Calendar" className="w-5 h-5" />
          </button>
          <button onClick={() => openExternal('https://keep.google.com', 'Google Keep')} className="p-2 hover:bg-gray-100 rounded-full" title="Keep">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Google_Keep_icon_%282020%29.svg/512px-Google_Keep_icon_%282020%29.svg.png" alt="Keep" className="w-5 h-5" />
          </button>
          <button onClick={() => openExternal('https://tasks.google.com', 'Google Tasks')} className="p-2 hover:bg-gray-100 rounded-full" title="Tasks">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Google_Tasks_2021.svg/512px-Google_Tasks_2021.svg.png" alt="Tasks" className="w-5 h-5" />
          </button>
          <button onClick={() => openExternal('https://contacts.google.com', 'Google Contacts')} className="p-2 hover:bg-gray-100 rounded-full" title="Contacts">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Google_Contacts_icon.svg/512px-Google_Contacts_icon.svg.png" alt="Contacts" className="w-5 h-5" />
          </button>
          <div className="w-5 h-px bg-gray-200 my-2"></div>
          <button onClick={() => openExternal('https://workspace.google.com/marketplace', 'Workspace Marketplace')} className="p-2 hover:bg-gray-100 rounded-full text-gray-600" title="Get add-ons">
            <Plus className="w-5 h-5" />
          </button>
        </aside>
      </div>

      {showSettingsPanel && (
        <div className="absolute right-20 top-20 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Quick settings</h3>
          <button
            onClick={() => setSearchQuery('')}
            className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 text-sm text-gray-700"
          >
            Clear search
          </button>
          <button
            onClick={() => setCurrentFolder('inbox')}
            className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 text-sm text-gray-700"
          >
            Return to inbox
          </button>
          <button
            onClick={refreshEmails}
            className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 text-sm text-gray-700"
          >
            Refresh now
          </button>
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

      {statusMessage && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-full text-sm shadow-lg z-30">
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
