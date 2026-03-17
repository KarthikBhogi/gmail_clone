export interface MockEmail {
  id: string;
  subject: string;
  snippet: string;
  sender: string;
  date: string;
  unread: boolean;
  starred?: boolean;
  category?: 'primary' | 'promotions' | 'social' | 'updates';
  attachments?: { name: string; type: string }[];
  messages: { id: string; sender: string; body: string; date: string }[];
}

export const mockEmails: MockEmail[] = [
  {
    id: "thread-1",
    subject: "Welcome to Firebase",
    snippet: "View the web version if this email isn't displaying well. Welcome to Firebase Hi Karthik, Welcome to Fireba...",
    sender: "Firebase",
    date: "2026-03-17T00:35:00Z",
    unread: false,
    messages: [
      { id: "msg-1", sender: "Firebase", body: "Welcome to Firebase...", date: "2026-03-17T00:35:00Z" }
    ]
  },
  {
    id: "thread-2",
    subject: "Combined Equity Contract Note for WJF945 - March 17, 2026",
    snippet: "Dear KARTHIK BHOGI, Attached is the combined equity contract ...",
    sender: "Zerodha Broking Ltd",
    date: "2026-03-17T21:24:00Z",
    unread: false,
    attachments: [{ name: "17-03-2026-co...", type: "pdf" }],
    messages: [
      { id: "msg-2", sender: "Zerodha Broking Ltd", body: "Dear KARTHIK BHOGI...", date: "2026-03-17T21:24:00Z" }
    ]
  },
  {
    id: "thread-3",
    subject: "Payment Reminder",
    snippet: "Hi Karthik, Your prepaid recharge bill payment is due today Hi Karthik, Your prepaid recharge bill payment is...",
    sender: "Amazon Pay India",
    date: "2026-03-17T20:42:00Z",
    unread: false,
    messages: [
      { id: "msg-3", sender: "Amazon Pay India", body: "Payment Reminder...", date: "2026-03-17T20:42:00Z" }
    ]
  },
  {
    id: "thread-4",
    subject: "📈 Nifty Extends Recovery; RVNL, Oberoi Realty Gain",
    snippet: "17 March, 2026 Key Takeaways • Sensex and Nifty : Following the strong r...",
    sender: "Market Charcha by A.",
    date: "2026-03-17T19:58:00Z",
    unread: false,
    messages: [
      { id: "msg-4", sender: "Market Charcha by A.", body: "Nifty Extends Recovery...", date: "2026-03-17T19:58:00Z" }
    ]
  },
  {
    id: "thread-5",
    subject: "❗ You have done a UPI txn. Check details!",
    snippet: "Dear Customer, Rs.12.00 has been debited from your HDFC Bank RuPay Credit Card...",
    sender: "HDFC Bank InstaAler.",
    date: "2026-03-17T18:11:00Z",
    unread: false,
    messages: [
      { id: "msg-5", sender: "HDFC Bank InstaAler.", body: "UPI txn...", date: "2026-03-17T18:11:00Z" }
    ]
  },
  {
    id: "thread-6",
    subject: "Get your hands on the exclusive official merch signed by Ranveer Singh.",
    snippet: "Starting at ₹349*, only on AJIO. Grab it before it's gon...",
    sender: "AJIO",
    date: "2026-03-17T14:25:00Z",
    unread: false,
    messages: [
      { id: "msg-6", sender: "AJIO", body: "Exclusive merch...", date: "2026-03-17T14:25:00Z" }
    ]
  },
  {
    id: "thread-7",
    subject: "Transactions In Your Demat Account",
    snippet: "Dear KARTHIK, Following is/are the list of transactions for your Demat account ending wit...",
    sender: "services",
    date: "2026-03-17T10:00:00Z",
    unread: false,
    messages: [
      { id: "msg-7", sender: "services", body: "Transactions...", date: "2026-03-17T10:00:00Z" }
    ]
  },
  {
    id: "thread-8",
    subject: "Coin by Zerodha - Allotment report - 17-03-2026",
    snippet: "Hi Karthik (WJF945), Here are your latest mutual fund updates. Allotment suc...",
    sender: "Zerodha",
    date: "2026-03-17T09:00:00Z",
    unread: false,
    messages: [
      { id: "msg-8", sender: "Zerodha", body: "Allotment report...", date: "2026-03-17T09:00:00Z" }
    ]
  },
  {
    id: "thread-9",
    subject: "Daily Equity Margin Statement for WJF945 - March 16, 2026",
    snippet: "Dear KARTHIK BHOGI, Attached is the daily equity margin stateme...",
    sender: "Zerodha Broking Ltd",
    date: "2026-03-17T08:00:00Z",
    unread: false,
    attachments: [{ name: "16-03-2026-ma...", type: "pdf" }],
    messages: [
      { id: "msg-9", sender: "Zerodha Broking Ltd", body: "Margin statement...", date: "2026-03-17T08:00:00Z" }
    ]
  },
  {
    id: "thread-10",
    subject: "Trades executed at NSE",
    snippet: "Dear Investor, With reference to SEBI circular ref no. CIR/MIRSD/15/2011dated August 02, 2011, a SMS ...",
    sender: "nse-direct",
    date: "2026-03-17T07:00:00Z",
    unread: false,
    attachments: [{ name: "trade_details_E...", type: "pdf" }],
    messages: [
      { id: "msg-10", sender: "nse-direct", body: "Trades executed...", date: "2026-03-17T07:00:00Z" }
    ]
  },
  {
    id: "thread-11",
    subject: "Your Swiggy order was successfully delivered",
    snippet: "Greetings from Swiggy Your order was delivered successfully. Rate your delivery ...",
    sender: "Swiggy",
    date: "2026-03-16T20:00:00Z",
    unread: false,
    attachments: [{ name: "taco/232651337...", type: "pdf" }],
    messages: [
      { id: "msg-11", sender: "Swiggy", body: "Order delivered...", date: "2026-03-16T20:00:00Z" }
    ]
  }
];
