import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginWithGoogle, logout } from './firebase';
import { Inbox } from './components/Inbox';
import { WeeklyReview } from './components/WeeklyReview';
import { Menu, Search, Settings, HelpCircle, Grid, Mail, Inbox as InboxIcon, Send, File, CheckSquare, Star, Clock, Tag, MoreVertical, Plus, ChevronDown, Calendar, Lightbulb, CheckCircle, User as UserIcon } from 'lucide-react';
import { cn } from './lib/utils';
import { mockEmails as initialEmails, MockEmail } from './services/mockData';
import { fetchGmailEmails } from './services/gmailService';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingEmails, setFetchingEmails] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<'inbox' | 'starred' | 'snoozed' | 'sent' | 'drafts' | 'weekly-review'>('inbox');
  const [emails, setEmails] = useState<MockEmail[]>(initialEmails);

  const handleUpdateEmail = (id: string, updates: Partial<MockEmail>) => {
    setEmails(emails.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const handleDeleteEmails = (ids: Set<string>) => {
    setEmails(emails.filter(e => !ids.has(e.id)));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        const token = localStorage.getItem('gmail_access_token');
        if (token) {
          setFetchingEmails(true);
          try {
            const realEmails = await fetchGmailEmails(token, 50);
            setEmails(realEmails);
          } catch (error: any) {
            console.error("Failed to fetch real emails:", error);
            if (error.message === 'UNAUTHORIZED') {
              // Token expired, need to re-login
              localStorage.removeItem('gmail_access_token');
              // We could force logout here, but let's just let them use mock data or click a button to refresh
            } else if (error.message === 'FORBIDDEN') {
              console.warn("Gmail API access forbidden. Did you grant the required permissions?");
            }
          } finally {
            setFetchingEmails(false);
          }
        }
      }
      
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await loginWithGoogle();
      
      // Fetch emails immediately after successful login to avoid race condition with onAuthStateChanged
      const token = localStorage.getItem('gmail_access_token');
      if (token) {
        setFetchingEmails(true);
        try {
          const realEmails = await fetchGmailEmails(token, 50);
          setEmails(realEmails);
        } catch (error: any) {
          console.error("Failed to fetch real emails after login:", error);
        } finally {
          setFetchingEmails(false);
        }
      }
    } catch (e) {
      console.error("Login failed", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-gray-50">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-gray-200 max-w-md w-full">
          <div className="flex justify-center mb-6">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gmail_icon_%282020%29.svg/512px-Gmail_icon_%282020%29.svg.png" alt="Gmail" className="h-12 w-12" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Welcome to Gmail Clone</h1>
          <p className="text-gray-500 mb-8">Sign in to access your real inbox and weekly review assistant.</p>
          <button
            onClick={handleLogin}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white text-gray-900 font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-white z-10">
        <div className="flex items-center gap-4 w-64">
          <button className="p-3 hover:bg-gray-100 rounded-full text-gray-600">
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
              className="bg-transparent border-none outline-none w-full text-base text-gray-700 placeholder-gray-600"
            />
            <button className="p-1 hover:bg-gray-200 rounded-full text-gray-600">
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 w-64 justify-end pr-2">
          <button className="p-2.5 hover:bg-gray-100 rounded-full text-gray-600">
            <HelpCircle className="h-6 w-6" />
          </button>
          <button className="p-2.5 hover:bg-gray-100 rounded-full text-gray-600">
            <Settings className="h-6 w-6" />
          </button>
          <button className="p-2.5 hover:bg-gray-100 rounded-full text-gray-600">
            <Grid className="h-6 w-6" />
          </button>
          <button onClick={logout} className="ml-2 h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium text-sm overflow-hidden border-2 border-white shadow-sm">
            {user.photoURL ? <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : user.email?.charAt(0).toUpperCase()}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-64 flex-shrink-0 bg-white py-2 flex flex-col">
          <div className="px-3 mb-4">
            <button className="flex items-center gap-4 bg-[#c2e7ff] hover:bg-[#b3dcf4] text-[#001d35] px-5 py-4 rounded-2xl font-medium transition-colors shadow-sm">
              <svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M20.41 4.94l-1.35-1.35c-.78-.78-2.05-.78-2.83 0L13.4 6.41 3 16.82V21h4.18l10.46-10.46 2.77-2.77c.79-.78.79-2.05 0-2.83zm-14 14.12L5 19v-1.36l9.82-9.82 1.41 1.41-9.82 9.83z"/></svg>
              <span className="text-sm font-medium">Compose</span>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <ul className="space-y-0.5 pr-4">
              <li>
                <button 
                  onClick={() => setCurrentFolder('inbox')}
                  className={cn("w-full flex items-center justify-between px-6 py-1.5 rounded-r-full text-sm", currentFolder === 'inbox' ? 'bg-[#d3e3fd] text-[#041e49] font-semibold' : 'text-gray-700 hover:bg-gray-100')}
                >
                  <div className="flex items-center gap-4">
                    <InboxIcon className={cn("h-5 w-5", currentFolder === 'inbox' ? 'text-[#041e49]' : 'text-gray-600')} />
                    Inbox
                  </div>
                  {emails.filter(e => e.unread).length > 0 && <span className="text-xs font-bold">{emails.filter(e => e.unread).length}</span>}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setCurrentFolder('starred')}
                  className={cn("w-full flex items-center gap-4 px-6 py-1.5 rounded-r-full text-sm", currentFolder === 'starred' ? 'bg-[#d3e3fd] text-[#041e49] font-semibold' : 'text-gray-700 hover:bg-gray-100')}
                >
                  <Star className={cn("h-5 w-5", currentFolder === 'starred' ? 'text-[#041e49]' : 'text-gray-600')} />
                  Starred
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setCurrentFolder('snoozed')}
                  className={cn("w-full flex items-center gap-4 px-6 py-1.5 rounded-r-full text-sm", currentFolder === 'snoozed' ? 'bg-[#d3e3fd] text-[#041e49] font-semibold' : 'text-gray-700 hover:bg-gray-100')}
                >
                  <Clock className={cn("h-5 w-5", currentFolder === 'snoozed' ? 'text-[#041e49]' : 'text-gray-600')} />
                  Snoozed
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setCurrentFolder('sent')}
                  className={cn("w-full flex items-center gap-4 px-6 py-1.5 rounded-r-full text-sm", currentFolder === 'sent' ? 'bg-[#d3e3fd] text-[#041e49] font-semibold' : 'text-gray-700 hover:bg-gray-100')}
                >
                  <Send className={cn("h-5 w-5", currentFolder === 'sent' ? 'text-[#041e49]' : 'text-gray-600')} />
                  Sent
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setCurrentFolder('drafts')}
                  className={cn("w-full flex items-center justify-between px-6 py-1.5 rounded-r-full text-sm", currentFolder === 'drafts' ? 'bg-[#d3e3fd] text-[#041e49] font-semibold' : 'text-gray-700 hover:bg-gray-100')}
                >
                  <div className="flex items-center gap-4">
                    <File className={cn("h-5 w-5", currentFolder === 'drafts' ? 'text-[#041e49]' : 'text-gray-600')} />
                    Drafts
                  </div>
                </button>
              </li>
              <li>
                <button className="w-full flex items-center gap-4 px-6 py-1.5 rounded-r-full text-sm text-gray-700 hover:bg-gray-100">
                  <Tag className="h-5 w-5 text-gray-600" />
                  Purchases
                </button>
              </li>
              <li>
                <button className="w-full flex items-center gap-4 px-6 py-1.5 rounded-r-full text-sm text-gray-700 hover:bg-gray-100">
                  <ChevronDown className="h-5 w-5 text-gray-600" />
                  More
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setCurrentFolder('weekly-review')}
                  className={cn("w-full flex items-center gap-4 px-6 py-1.5 rounded-r-full text-sm mt-2", currentFolder === 'weekly-review' ? 'bg-[#d3e3fd] text-[#041e49] font-semibold' : 'text-gray-700 hover:bg-gray-100')}
                >
                  <CheckSquare className={cn("h-5 w-5", currentFolder === 'weekly-review' ? 'text-[#041e49]' : 'text-gray-600')} />
                  Weekly Review
                </button>
              </li>
            </ul>

            <div className="mt-6">
              <div className="flex items-center justify-between px-6 py-2 group cursor-pointer">
                <span className="text-sm font-medium text-gray-800">Labels</span>
                <Plus className="h-4 w-4 text-gray-500 opacity-0 group-hover:opacity-100" />
              </div>
              <ul className="space-y-0.5 pr-4 mt-1">
                <li>
                  <button className="w-full flex items-center gap-4 px-6 py-1.5 rounded-r-full text-sm text-gray-700 hover:bg-gray-100">
                    <div className="w-3 h-3 rounded-sm bg-gray-500"></div>
                    CAT2024
                  </button>
                </li>
                <li>
                  <button className="w-full flex items-center gap-4 px-6 py-1.5 rounded-r-full text-sm text-gray-700 hover:bg-gray-100">
                    <div className="w-3 h-3 rounded-sm bg-red-500"></div>
                    McAfee Alert
                  </button>
                </li>
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
            <WeeklyReview emails={emails} onComplete={() => setCurrentFolder('inbox')} />
          ) : (
            <Inbox 
              folder={currentFolder} 
              emails={emails} 
              onUpdateEmail={handleUpdateEmail}
              onDeleteEmails={handleDeleteEmails}
              onStartReview={() => setCurrentFolder('weekly-review')} 
            />
          )}
        </main>

        {/* Right Sidebar */}
        <aside className="w-14 flex-shrink-0 bg-white flex flex-col items-center py-4 gap-6 border-l border-gray-100">
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/512px-Google_Calendar_icon_%282020%29.svg.png" alt="Calendar" className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Google_Keep_icon_%282020%29.svg/512px-Google_Keep_icon_%282020%29.svg.png" alt="Keep" className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Google_Tasks_2021.svg/512px-Google_Tasks_2021.svg.png" alt="Tasks" className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Google_Contacts_icon.svg/512px-Google_Contacts_icon.svg.png" alt="Contacts" className="w-5 h-5" />
          </button>
          <div className="w-5 h-px bg-gray-200 my-2"></div>
          <button className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
            <Plus className="w-5 h-5" />
          </button>
        </aside>
      </div>
    </div>
  );
}
