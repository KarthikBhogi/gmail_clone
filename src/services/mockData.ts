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
    id: "thread-cto-1",
    subject: "Action required: Approve Q2 platform hiring plan by Friday",
    snippet: "Rahul, sharing final headcount proposal for Platform Engineering. Please approve or suggest changes before Friday 5:00 PM.",
    sender: "Anita Rao (HRBP)",
    date: "2026-03-18T08:35:00Z",
    unread: true,
    starred: true,
    category: "primary",
    messages: [
      { id: "msg-cto-1", sender: "Anita Rao (HRBP)", body: "Rahul, attached is the final Q2 hiring plan. We need your sign-off before Friday to release offers for SRE and backend roles.", date: "2026-03-18T08:35:00Z" }
    ]
  },
  {
    id: "thread-cto-2",
    subject: "Escalation: P1 payment API incident RCA due tonight",
    snippet: "Thanks Rahul, we have added owners for each corrective action. Please confirm before we send to exec staff.",
    sender: "Nikhil S (SRE Lead)",
    date: "2026-03-18T07:52:00Z",
    unread: true,
    starred: true,
    category: "updates",
    attachments: [{ name: "payment-p1-timeline.pdf", type: "pdf" }],
    messages: [
      { id: "msg-cto-2-1", sender: "Nikhil S (SRE Lead)", body: "Initial RCA draft attached. Root cause appears to be timeout misconfiguration in payment orchestration service.", date: "2026-03-18T06:58:00Z" },
      { id: "msg-cto-2-2", sender: "Rahul Mehta", body: "Please include customer impact numbers and assign clear owners with dates for each corrective action.", date: "2026-03-18T07:20:00Z" },
      { id: "msg-cto-2-3", sender: "Nikhil S (SRE Lead)", body: "Thanks Rahul, we have added owners for each corrective action. Please confirm before we send to exec staff.", date: "2026-03-18T07:52:00Z" }
    ]
  },
  {
    id: "thread-cto-3",
    subject: "Board pre-read: AI roadmap and infra cost curve",
    snippet: "Please review the board pre-read draft. Need your comments on GenAI infra spend assumptions and delivery milestones.",
    sender: "CEO Office",
    date: "2026-03-18T06:40:00Z",
    unread: true,
    category: "primary",
    messages: [
      { id: "msg-cto-3", sender: "CEO Office", body: "Rahul, board pack freezes by Thursday 2 PM. Please add your comments on roadmap risks and cost controls.", date: "2026-03-18T06:40:00Z" }
    ]
  },
  {
    id: "thread-cto-4",
    subject: "Re: Enterprise deal blocker - SOC2 evidence request",
    snippet: "Client accepted the control mapping format. We still need final sign-off on pen-test letter wording.",
    sender: "Priya M (Sales Director)",
    date: "2026-03-18T05:59:00Z",
    unread: true,
    category: "primary",
    messages: [
      { id: "msg-cto-4-1", sender: "Priya M (Sales Director)", body: "Client security team needs latest SOC2 control mapping and pen-test letter before procurement can proceed.", date: "2026-03-18T05:11:00Z" },
      { id: "msg-cto-4-2", sender: "Rahul Mehta", body: "Share v3 mapping now. Ask legal to review the pen-test letter language for liability before external sharing.", date: "2026-03-18T05:36:00Z" },
      { id: "msg-cto-4-3", sender: "Priya M (Sales Director)", body: "Client accepted the control mapping format. We still need final sign-off on pen-test letter wording.", date: "2026-03-18T05:59:00Z" }
    ]
  },
  {
    id: "thread-cto-5",
    subject: "Reminder: Product-Engineering weekly sync agenda",
    snippet: "Noted. I have added API reliability, release risk, and hiring dependencies as top 3 agenda items.",
    sender: "Maya G (Chief Product Officer)",
    date: "2026-03-17T17:41:00Z",
    unread: false,
    category: "primary",
    messages: [
      { id: "msg-cto-5-1", sender: "Maya G (Chief Product Officer)", body: "Please add discussion points for API stability, on-call fatigue, and Q2 release train dependencies.", date: "2026-03-17T16:42:00Z" },
      { id: "msg-cto-5-2", sender: "Rahul Mehta", body: "Will do. Also including dependency risks with Data Platform migration and two escalation trends from support.", date: "2026-03-17T17:05:00Z" },
      { id: "msg-cto-5-3", sender: "Maya G (Chief Product Officer)", body: "Noted. I have added API reliability, release risk, and hiring dependencies as top 3 agenda items.", date: "2026-03-17T17:41:00Z" }
    ]
  },
  {
    id: "thread-cto-6",
    subject: "Draft ready: Engineering all-hands talking points",
    snippet: "Shared draft includes reliability wins, missed SLAs, and next-quarter priorities. Need your edits.",
    sender: "Chief of Staff - Tech",
    date: "2026-03-17T16:18:00Z",
    unread: false,
    category: "updates",
    messages: [
      { id: "msg-cto-6", sender: "Chief of Staff - Tech", body: "Please review sections 2 and 4 where we mention incident debt and staffing gaps.", date: "2026-03-17T16:18:00Z" }
    ]
  },
  {
    id: "thread-cto-7",
    subject: "Customer complaint cluster: delayed webhook events",
    snippet: "Customer-safe update draft is ready. Please approve before we post to impacted accounts.",
    sender: "Head of Support",
    date: "2026-03-17T15:30:00Z",
    unread: true,
    category: "updates",
    messages: [
      { id: "msg-cto-7-1", sender: "Head of Support", body: "Support observed 37 enterprise tickets around delayed webhook delivery. Need owner and ETA for fix.", date: "2026-03-17T14:44:00Z" },
      { id: "msg-cto-7-2", sender: "Rahul Mehta", body: "Assign this to Platform Messaging. Ask SRE for mitigation ETA and share a customer-safe status update by EOD.", date: "2026-03-17T15:06:00Z" },
      { id: "msg-cto-7-3", sender: "Head of Support", body: "Customer-safe update draft is ready. Please approve before we post to impacted accounts.", date: "2026-03-17T15:30:00Z" }
    ]
  },
  {
    id: "thread-cto-8",
    subject: "Final reminder: Submit budget variance note",
    snippet: "Finance closes this week today. Please submit commentary on cloud overrun and mitigation plan.",
    sender: "Finance Controller",
    date: "2026-03-17T14:55:00Z",
    unread: true,
    starred: true,
    category: "updates",
    messages: [
      { id: "msg-cto-8", sender: "Finance Controller", body: "Need your written note before 6 PM to close monthly reporting.", date: "2026-03-17T14:55:00Z" }
    ]
  },
  {
    id: "thread-cto-9",
    subject: "Security review: vendor DPA redlines pending",
    snippet: "Updated draft attached with your retention comments reflected. Please confirm we can send to vendor.",
    sender: "Legal Ops",
    date: "2026-03-17T13:20:00Z",
    unread: false,
    category: "primary",
    attachments: [{ name: "vendor-dpa-redline-v4.docx", type: "doc" }],
    messages: [
      { id: "msg-cto-9-1", sender: "Legal Ops", body: "Legal has completed first-pass redlines. Need technology sign-off on data retention and subprocessors.", date: "2026-03-17T12:37:00Z" },
      { id: "msg-cto-9-2", sender: "Rahul Mehta", body: "30-day retention is acceptable for telemetry logs. Please ensure exception handling for security investigation holds.", date: "2026-03-17T12:58:00Z" },
      { id: "msg-cto-9-3", sender: "Legal Ops", body: "Updated draft attached with your retention comments reflected. Please confirm we can send to vendor.", date: "2026-03-17T13:20:00Z" }
    ]
  },
  {
    id: "thread-cto-10",
    subject: "Design review notes: mobile auth revamp",
    snippet: "UX and engineering comments consolidated. Need your call on rollout phasing for passkeys.",
    sender: "Ritika P (Design Lead)",
    date: "2026-03-17T12:10:00Z",
    unread: false,
    category: "primary",
    messages: [
      { id: "msg-cto-10", sender: "Ritika P (Design Lead)", body: "Need your final decision: one-step passkey rollout vs staged fallback path.", date: "2026-03-17T12:10:00Z" }
    ]
  },
  {
    id: "thread-cto-11",
    subject: "Re: India engineering offsite - venue options",
    snippet: "Sharing final venue shortlist, budget impact, and travel windows for leadership review.",
    sender: "People Operations",
    date: "2026-03-17T11:30:00Z",
    unread: false,
    category: "updates",
    messages: [
      { id: "msg-cto-11", sender: "People Operations", body: "Need confirmation by Thursday so invites can go out.", date: "2026-03-17T11:30:00Z" }
    ]
  },
  {
    id: "thread-cto-12",
    subject: "Mentions you in #incident-war-room",
    snippet: "Suresh: Rahul can you review fallback proposal for queue saturation before we execute?",
    sender: "Slack",
    date: "2026-03-17T10:55:00Z",
    unread: true,
    category: "social",
    messages: [
      { id: "msg-cto-12", sender: "Slack", body: "You were mentioned by Suresh in #incident-war-room.", date: "2026-03-17T10:55:00Z" }
    ]
  },
  {
    id: "thread-cto-13",
    subject: "Your meeting notes are ready: Architecture Council",
    snippet: "Auto-generated summary and decision log from your Architecture Council meeting are now available.",
    sender: "Google Calendar",
    date: "2026-03-17T10:20:00Z",
    unread: false,
    category: "updates",
    messages: [
      { id: "msg-cto-13", sender: "Google Calendar", body: "Summary includes 6 decisions and 4 follow-ups assigned to engineering managers.", date: "2026-03-17T10:20:00Z" }
    ]
  },
  {
    id: "thread-cto-14",
    subject: "Cloud bill anomaly detected in ap-south-1",
    snippet: "Spend increased 18% day-over-day due to storage IO spikes on analytics cluster.",
    sender: "Cloud FinOps Bot",
    date: "2026-03-17T09:45:00Z",
    unread: true,
    category: "updates",
    messages: [
      { id: "msg-cto-14", sender: "Cloud FinOps Bot", body: "Recommend immediate limit policy and workload rebalancing to prevent further overrun.", date: "2026-03-17T09:45:00Z" }
    ]
  },
  {
    id: "thread-cto-15",
    subject: "Investor update request: AI assistant metrics",
    snippet: "Please share adoption, retention, and quality metrics by 3 PM for investor note.",
    sender: "Corporate Strategy",
    date: "2026-03-17T09:10:00Z",
    unread: true,
    category: "primary",
    messages: [
      { id: "msg-cto-15", sender: "Corporate Strategy", body: "Need numbers for weekly active usage and customer satisfaction delta post-launch.", date: "2026-03-17T09:10:00Z" }
    ]
  },
  {
    id: "thread-cto-16",
    subject: "You have 2 pending approvals in Jira",
    snippet: "Release-train exceptions require your approval to merge before cutoff.",
    sender: "Jira",
    date: "2026-03-17T08:30:00Z",
    unread: false,
    category: "updates",
    messages: [
      { id: "msg-cto-16", sender: "Jira", body: "Approval needed for PAY-1881 and CORE-9422 before release freeze.", date: "2026-03-17T08:30:00Z" }
    ]
  },
  {
    id: "thread-cto-17",
    subject: "[Promo] Leadership summit tickets close tonight",
    snippet: "Early access for technology leaders. Save 30% on registrations ending midnight.",
    sender: "TechSummit Events",
    date: "2026-03-17T07:55:00Z",
    unread: false,
    category: "promotions",
    messages: [
      { id: "msg-cto-17", sender: "TechSummit Events", body: "Join 200+ CTOs for discussions on AI governance and platform strategy.", date: "2026-03-17T07:55:00Z" }
    ]
  },
  {
    id: "thread-cto-18",
    subject: "Fwd: Candidate packet - Principal Architect",
    snippet: "Candidate accepted tomorrow 11:30 AM panel. Calendar invite sent to all interviewers.",
    sender: "Talent Acquisition",
    date: "2026-03-16T19:40:00Z",
    unread: false,
    category: "primary",
    attachments: [{ name: "principal-architect-cv.pdf", type: "pdf" }],
    messages: [
      { id: "msg-cto-18-1", sender: "Talent Acquisition", body: "Candidate has offers in hand, request your interview availability tomorrow.", date: "2026-03-16T18:48:00Z" },
      { id: "msg-cto-18-2", sender: "Rahul Mehta", body: "I can do 11:30 to 12:00 tomorrow. Please include Platform Director and Security Architect in panel.", date: "2026-03-16T19:05:00Z" },
      { id: "msg-cto-18-3", sender: "Talent Acquisition", body: "Candidate accepted tomorrow 11:30 AM panel. Calendar invite sent to all interviewers.", date: "2026-03-16T19:40:00Z" }
    ]
  }
];
