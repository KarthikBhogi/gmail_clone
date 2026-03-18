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

type MailCategory = 'primary' | 'promotions' | 'updates';

type Contact = {
  sender: string;
  name: string;
  role: string;
  defaultGreeting: string;
};

type SingleSeed = {
  subject: string;
  contact: Contact;
  date: string;
  unread: boolean;
  starred?: boolean;
  category: MailCategory;
  summary: string;
  ask: string;
  attachments?: { name: string; type: string }[];
};

type ThreadSeed = {
  subject: string;
  contact: Contact;
  date: string;
  unread: boolean;
  starred?: boolean;
  category: MailCategory;
  size: 2 | 3 | 4;
  context: string;
  ask: string;
  close: string;
};

const RAHUL: Contact = {
  sender: 'Rahul Mehta <rahul.mehta@xyz.com>',
  name: 'Rahul Mehta',
  role: 'Chief Technology Officer, XYZ Corporation',
  defaultGreeting: 'Hi Team',
};

const CONTACTS = {
  ceoOffice: {
    sender: 'Rajesh Magow (Group CEO) <rajesh.magow@xyz.com>',
    name: 'Rajesh Magow',
    role: 'Group CEO, XYZ Corporation',
    defaultGreeting: 'Hi Rahul',
  },
  vpEng: {
    sender: 'Sanjay Sharma (VP Engineering) <sanjay.sharma@xyz.com>',
    name: 'Sanjay Sharma',
    role: 'VP Engineering (Flights & Hotels)',
    defaultGreeting: 'Rahul',
  },
  archCouncil: {
    sender: 'MMT Architecture Council <arch-council@xyz.com>',
    name: 'Architecture Council',
    role: 'Core Systems Architecture',
    defaultGreeting: 'Hi Rahul',
  },
  marketingTech: {
    sender: 'Neha Gupta (CMO) <neha.gupta@xyz.com>',
    name: 'Neha Gupta',
    role: 'Chief Marketing Officer',
    defaultGreeting: 'Hi Rahul',
  },
  sreTeam: {
    sender: 'Site Reliability Engineering <sre-alerts@xyz.com>',
    name: 'SRE Team',
    role: 'Infrastructure & Reliability',
    defaultGreeting: 'Rahul',
  },
  awsTeam: {
    sender: 'Vikram Singh (AWS Enterprise) <vikrams@amazon.com>',
    name: 'Vikram Singh',
    role: 'Enterprise Account Manager, AWS',
    defaultGreeting: 'Hi Rahul',
  },
  vpProduct: {
    sender: 'Anjali Desai (CPO) <anjali.desai@xyz.com>',
    name: 'Anjali Desai',
    role: 'Chief Product Officer',
    defaultGreeting: 'Hi Rahul',
  },
  securityTeam: {
    sender: 'InfoSec & Compliance <infosec@xyz.com>',
    name: 'InfoSec Team',
    role: 'Security Operations Center',
    defaultGreeting: 'Dear Rahul',
  },
  itSupport: {
    sender: 'Corporate IT Helpdesk <it-support@xyz.com>',
    name: 'IT Support',
    role: 'Internal Systems',
    defaultGreeting: 'Hello Rahul',
  },
  engLeadership: {
    sender: 'Engineering Leadership <eng-leads@xyz.com>',
    name: 'Engineering Leadership',
    role: 'Directors & VPs of Engineering',
    defaultGreeting: 'Team',
  },
  talentAcquisition: {
    sender: 'Tech Talent Acquisition <tech-hiring@xyz.com>',
    name: 'TA Team',
    role: 'Executive Hiring',
    defaultGreeting: 'Hi Rahul',
  },
  finOps: {
    sender: 'Cloud FinOps <finops@xyz.com>',
    name: 'FinOps Team',
    role: 'Cloud Cost Management',
    defaultGreeting: 'Hi Rahul',
  },
  tajhotels: {
    sender: 'Taj Hotels <promotions@tajhotels.com>',
    name: 'Taj InnerCircle',
    role: 'Hospitality Partner',
    defaultGreeting: 'Dear Mr. Mehta',
  },
  apple: {
    sender: 'Apple Enterprise <enterprise@apple.com>',
    name: 'Apple Business',
    role: 'Hardware Procurement',
    defaultGreeting: 'Hello Rahul',
  },
  amazon: {
    sender: 'AWS re:Invent <reinvent@amazon.com>',
    name: 'AWS Events',
    role: 'Tech Conferences',
    defaultGreeting: 'Dear Rahul',
  },
  amex: {
    sender: 'Amex Platinum <rewards@americanexpress.com>',
    name: 'American Express',
    role: 'Corporate Cards',
    defaultGreeting: 'Hi Rahul',
  },
  hdfc: {
    sender: 'Bank Alerts <noreply@hdfcbank.net>',
    name: 'HDFC Bank Alerts',
    role: 'Banking Notifications',
    defaultGreeting: 'Dear Rahul',
  },
  zerodha: {
    sender: 'Zerodha Console <alerts@zerodha.com>',
    name: 'Zerodha Console',
    role: 'Portfolio Update Notifications',
    defaultGreeting: 'Hi Rahul',
  },
  linkedin: {
    sender: 'LinkedIn <messages-noreply@linkedin.com>',
    name: 'LinkedIn Team',
    role: 'Network and Opportunity Alerts',
    defaultGreeting: 'Hello Rahul',
  },
  jira: {
    sender: 'Jira Software <jira@xyz.atlassian.net>',
    name: 'Jira Notifications',
    role: 'Issue Tracking',
    defaultGreeting: 'Rahul',
  },
  awsAlerts: {
    sender: 'AWS CloudWatch <no-reply-aws@amazon.com>',
    name: 'AWS CloudWatch Bot',
    role: 'System Alerts Automation',
    defaultGreeting: 'Alert',
  },
} as const;

let threadCounter = 1;
let messageCounter = 1;

const createThreadId = () => `thread-${String(threadCounter++).padStart(4, '0')}`;
const createMessageId = () => `msg-${String(messageCounter++).padStart(5, '0')}`;

const withOffsetHours = (isoDate: string, offsetHours: number) => {
  const date = new Date(isoDate);
  date.setHours(date.getHours() + offsetHours);
  return date.toISOString();
};

const normalizeSnippet = (body: string) => body.replace(/\s+/g, ' ').trim().slice(0, 160);

const buildBody = (greeting: string, paragraphs: string[], name: string, role: string) => {
  return `${greeting},\n\n${paragraphs.join('\n\n')}\n\nRegards,\n${name}\n${role}`;
};

const createSingleEmail = (seed: SingleSeed): MockEmail => {
  const body = buildBody(
    seed.contact.defaultGreeting,
    [seed.summary, seed.ask],
    seed.contact.name,
    seed.contact.role
  );

  const message = {
    id: createMessageId(),
    sender: seed.contact.sender,
    body,
    date: seed.date,
  };

  return {
    id: createThreadId(),
    subject: seed.subject,
    snippet: normalizeSnippet(body),
    sender: seed.contact.sender,
    date: seed.date,
    unread: seed.unread,
    starred: seed.starred ?? false,
    category: seed.category,
    attachments: seed.attachments,
    messages: [message],
  };
};

const createThreadEmail = (seed: ThreadSeed): MockEmail => {
  const messages: { id: string; sender: string; body: string; date: string }[] = [];
  const openingDate = withOffsetHours(seed.date, -(seed.size * 3));

  const openingBody = buildBody(
    seed.contact.defaultGreeting,
    [seed.context, seed.ask],
    seed.contact.name,
    seed.contact.role
  );

  messages.push({
    id: createMessageId(),
    sender: seed.contact.sender,
    body: openingBody,
    date: openingDate,
  });

  if (seed.size >= 2) {
    const rahulReply = buildBody(
      'Hi',
      [
        `Thanks for sharing this thread on "${seed.subject}". I reviewed the metrics from my side and aligned the engineering roadmap with the product managers.`,
        'I can take ownership of the next technical step by evening, and I will post the final architecture decision once the SRE team validates the infrastructure dependencies.',
      ],
      RAHUL.name,
      RAHUL.role
    );

    messages.push({
      id: createMessageId(),
      sender: RAHUL.sender,
      body: rahulReply,
      date: withOffsetHours(openingDate, 2),
    });
  }

  if (seed.size >= 3) {
    const followUp = buildBody(
      'Rahul',
      [
        `Perfect, that helps. ${seed.close}`,
        'Please keep me copied once you push the final deployment plan so I can update the wider executive thread and close the action item.',
      ],
      seed.contact.name,
      seed.contact.role
    );

    messages.push({
      id: createMessageId(),
      sender: seed.contact.sender,
      body: followUp,
      date: withOffsetHours(openingDate, 5),
    });
  }

  if (seed.size === 4) {
    const finalAck = buildBody(
      'Team',
      [
        'Noted and aligned. I have now shared the finalized system design and also added Jira tickets to the sprint tracker for clean closure.',
        'If there are no objections by tonight, we can merge the pull requests and move to the staging environment.',
      ],
      RAHUL.name,
      RAHUL.role
    );

    messages.push({
      id: createMessageId(),
      sender: RAHUL.sender,
      body: finalAck,
      date: withOffsetHours(openingDate, 7),
    });
  }

  const latestMessage = messages[messages.length - 1];

  return {
    id: createThreadId(),
    subject: seed.subject,
    snippet: normalizeSnippet(latestMessage.body),
    sender: seed.contact.sender,
    date: seed.date,
    unread: seed.unread,
    starred: seed.starred ?? false,
    category: seed.category,
    messages,
  };
};

const d = (day: number, hour: number, minute: number) =>
  `2026-03-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;

const currentWeekPrimaryThreads: ThreadSeed[] = [
  {
    subject: 'AWS Reserved Instances budget sign-off for Q2',
    contact: CONTACTS.finOps,
    date: d(18, 18, 40),
    unread: true,
    starred: true,
    category: 'primary',
    size: 3,
    context: 'The Cloud FinOps team has revised the Q2 AWS budget forecast and we need your final sign-off before we commit to the new 3-year Compute Savings Plans tomorrow morning.',
    ask: 'Could you review the provisioned capacity for the Flights microservices and confirm if we should keep a contingency buffer of 8%?',
    close: 'I already aligned the CFO on this version and only your technical approval is pending now.',
  },
  {
    subject: 'Architecture review on GenAI Itinerary Planner',
    contact: CONTACTS.vpProduct,
    date: d(18, 17, 15),
    unread: false,
    category: 'primary',
    size: 4,
    context: 'I have uploaded comments on your latest API design draft and highlighted the latency SLA section where the LLM fallback criteria need sharper wording.',
    ask: 'Please confirm if we should lock this as the final architecture before sharing with the frontend consumer teams.',
    close: 'Once you send the final PR, I will circulate it with a one-page integration explainer.',
  },
  {
    subject: 'CEO office note for Q1 Board Meeting tech slides',
    contact: CONTACTS.ceoOffice,
    date: d(18, 15, 55),
    unread: true,
    category: 'primary',
    size: 3,
    context: 'Rajesh wants your inputs on the slide sequencing for the Board Meeting, especially highlighting the new caching layer vs the mobile app rewrite metrics.',
    ask: 'Share your recommendation on the technical narrative order and we will freeze the master deck tonight.',
    close: 'Your perspective will help us keep the infrastructure investments clear for the board members.',
  },
  {
    subject: 'Load testing for Diwali Mega Sale dry run',
    contact: CONTACTS.sreTeam,
    date: d(18, 14, 30),
    unread: false,
    starred: true,
    category: 'primary',
    size: 3,
    context: 'We completed the dry run for 5x traffic projection, but there is still one blocker in the Redis cluster failover reconciliation.',
    ask: 'Can you validate whether the failover logic should prioritize regional replication or immediate sharding first?',
    close: 'If we lock this now, we can publish the final readiness report on time tomorrow.',
  },
  {
    subject: 'Engineering Leadership approval for backend mono-repo split',
    contact: CONTACTS.engLeadership,
    date: d(18, 13, 48),
    unread: true,
    category: 'primary',
    size: 2,
    context: 'We finalized the boundary contexts for the Hotels and Bus tracks, but the CI/CD pipeline format needs one final approval before rollout.',
    ask: 'Please review the proposed deployment splitting of unit tests, security scans, and staging pushes.',
    close: 'Your quick confirmation will allow us to lock the repository migration window tonight.',
  },
  {
    subject: 'Primary database migration downtime window',
    contact: CONTACTS.archCouncil,
    date: d(18, 12, 5),
    unread: false,
    category: 'primary',
    size: 3,
    context: 'Migration on the legacy booking DB to Aurora PostgreSQL may affect read-replicas for two hours this week.',
    ask: 'Please confirm if your teams prefer the 2 AM to 4 AM IST slot so we can schedule the downtime.',
    close: 'Once confirmed, we will issue a final maintenance notice to all B2B API partners.',
  },
  {
    subject: 'Security team report on Zero-day patch deployment',
    contact: CONTACTS.securityTeam,
    date: d(17, 19, 18),
    unread: true,
    category: 'primary',
    size: 3,
    context: 'Several tech leads asked if the WAF rules and the emergency NGINX patches are both required for the upcoming release cycle.',
    ask: 'Can you send your consolidated mandate so we enforce one consistent security policy across all pods?',
    close: 'We want to avoid gaps and ensure the zero-day mitigation is uniformly applied.',
  },
  {
    subject: 'AWS Summit keynote panel rehearsal feedback',
    contact: CONTACTS.awsTeam,
    date: d(17, 18, 42),
    unread: false,
    category: 'primary',
    size: 2,
    context: 'The keynote rehearsal looked strong, but your transitions between the serverless scaling and AI adoption felt abrupt in the first ten minutes.',
    ask: 'Could you suggest a tighter speaking order to improve narrative flow for the live keynote?',
    close: 'A refined sequence would make the technical deep-dive smoother for the audience.',
  },
  {
    subject: 'Marketing Tech integration for new ad campaign',
    contact: CONTACTS.marketingTech,
    date: d(17, 16, 26),
    unread: true,
    starred: true,
    category: 'primary',
    size: 3,
    context: 'Two ad networks are ready to go live, but both asked for latency guarantees on the real-time bidding pixel endpoints.',
    ask: 'Can you approve the edge-caching proposal so we can issue SLA confirmation letters to the vendors?',
    close: 'I will send the final integration matrix immediately after your go-ahead.',
  },
  {
    subject: 'SRE incident post-mortem for payment gateway timeout',
    contact: CONTACTS.sreTeam,
    date: d(17, 13, 55),
    unread: false,
    category: 'primary',
    size: 2,
    context: 'We received the root cause analysis and shortlisted action items based on the 5-Whys framework and Datadog logs.',
    ask: 'Please review the final RCA and flag any engineering teams who should prioritize the retry-mechanism fixes.',
    close: 'The final incident report will be sent to the executive team only after this is frozen.',
  },
  {
    subject: 'Director of Engineering interview loop sequencing',
    contact: CONTACTS.talentAcquisition,
    date: d(16, 18, 58),
    unread: true,
    category: 'primary',
    size: 3,
    context: 'Multiple candidates for the Hotels Engineering Director role have requested adjacent slots and we need to align the technical and culture rounds.',
    ask: 'Can you suggest the final sequencing so VP Engineering and you can attend without calendar clashes?',
    close: 'Once locked, we will publish calendar invites to the panel.',
  },
  {
    subject: 'Cloud FinOps anomaly alert reconciliation',
    contact: CONTACTS.finOps,
    date: d(16, 16, 44),
    unread: false,
    category: 'primary',
    size: 2,
    context: 'We detected a spike in two AWS accounts where Data Transfer and NAT Gateway costs differ by large margins compared to baseline.',
    ask: 'Could you verify the service owners before we trigger automatic scaling down of the NAT instances?',
    close: 'This will help close the weekly cloud burn rate cleanly.',
  },
];

const currentWeekPrimarySingles: SingleSeed[] = [
  {
    subject: 'Action Required: Tomorrow Executive Offsite starts at 8:00 AM',
    contact: CONTACTS.ceoOffice,
    date: d(18, 11, 38),
    unread: true,
    category: 'primary',
    summary: 'The strategic planning session has a pre-read regarding the international expansion tech readiness.',
    ask: 'Please review the M&A integration metrics tonight so we can personalize the technical strategy discussions.',
  },
  {
    subject: 'Corporate VPN upgrade notice for all remote engineers',
    contact: CONTACTS.itSupport,
    date: d(18, 10, 51),
    unread: false,
    category: 'primary',
    summary: 'VPN gateway hardware replacement is planned after midnight and connectivity may fluctuate for 25 minutes.',
    ask: 'Kindly share this note with the VP Engineering so teams can plan their deployments accordingly.',
  },
  {
    subject: 'Draft minutes: Tech Leadership and Product coordination meet',
    contact: CONTACTS.engLeadership,
    date: d(18, 10, 4),
    unread: false,
    category: 'primary',
    summary: 'Minutes include action points on sprint velocity feedback, technical debt allocation, and cross-team roadmap conflicts.',
    ask: 'Review and confirm if any item needs correction before we archive this in Confluence.',
    attachments: [{ name: 'Tech_Product_Sync_Minutes.pdf', type: 'pdf' }],
  },
  {
    subject: 'Approval needed: Confirm participation for Google Cloud AI summit',
    contact: CONTACTS.vpEng,
    date: d(18, 9, 25),
    unread: true,
    category: 'primary',
    summary: 'The executive roundtable has limited seats and we are closing VIP confirmations based on response timestamp.',
    ask: 'Reply with a yes or no before 7 PM so PR can confirm your speaker slot.',
  },
  {
    subject: 'Updated org chart for Friday re-org announcement',
    contact: CONTACTS.talentAcquisition,
    date: d(18, 8, 42),
    unread: false,
    category: 'primary',
    summary: 'The org structure now aligns the Data Science team directly under your office to speed up GenAI deployments.',
    ask: 'Please cross-check the reporting lines and report any mismatches by noon.',
    attachments: [{ name: 'Engineering_Org_v2.xlsx', type: 'xlsx' }],
  },
  {
    subject: 'Vendor Connect: Akamai edge computing roadmap',
    contact: CONTACTS.awsTeam,
    date: d(17, 12, 18),
    unread: true,
    category: 'primary',
    summary: 'We curated a focused session with Akamai engineers who recently scaled edge functions for competitor platforms.',
    ask: 'Share your top two architectural concerns so we can prioritize themes that matter most to our caching strategy.',
  },
  {
    subject: 'Checklist before tomorrow Chaos Engineering simulation',
    contact: CONTACTS.sreTeam,
    date: d(17, 11, 50),
    unread: false,
    category: 'primary',
    summary: 'Please keep your PagerDuty access handy and monitor the Datadog dashboards during the network partition test.',
    ask: 'If any critical alerts fail to fire, report by 5 PM so we can fix the routing rules before the game day.',
  },
  {
    subject: 'Product Manager note on API deprecation timeline',
    contact: CONTACTS.vpProduct,
    date: d(17, 10, 27),
    unread: false,
    category: 'primary',
    summary: 'The product team has asked for an extended window for the v1 Hotels API, citing partner integration delays.',
    ask: 'Please recheck your infrastructure decommissioning deck and let us know if we can support v1 until Q4.',
  },
  {
    subject: 'Principal Engineer promotion panel slots are open',
    contact: CONTACTS.talentAcquisition,
    date: d(17, 9, 14),
    unread: true,
    category: 'primary',
    summary: 'Interview slots are available across backend, frontend, and data engineering tracks this week for the promotion cycle.',
    ask: 'Choose one slot today so we can assign you the calibration committee sessions.',
  },
  {
    subject: 'Calendar hold: Post-incident architecture peer review',
    contact: CONTACTS.archCouncil,
    date: d(17, 8, 45),
    unread: false,
    category: 'primary',
    summary: 'A peer review block has been scheduled to evaluate the database sharding proposal before the final budget cut-off.',
    ask: 'Please accept the calendar invite and mention if your availability timing needs adjustment.',
  },
  {
    subject: 'Hiring tracker updated with new Staff Engineer candidates',
    contact: CONTACTS.talentAcquisition,
    date: d(16, 15, 52),
    unread: true,
    starred: true,
    category: 'primary',
    summary: 'The tracker now includes six additional Staff Engineer profiles from top-tier tech companies.',
    ask: 'Kindly shortlist candidates you want to interview personally so we can schedule them in advance.',
    attachments: [{ name: 'Leadership_Hiring_Tracker.xlsx', type: 'xlsx' }],
  },
  {
    subject: 'Quick poll: Preferred vendor for new APM tool',
    contact: CONTACTS.sreTeam,
    date: d(16, 14, 30),
    unread: false,
    category: 'primary',
    summary: 'We are balancing Datadog and New Relic options based on pricing, distributed tracing features, and support.',
    ask: 'Vote by end of day so we can lock the final vendor contract.',
  },
  {
    subject: 'Revised technical responsibility matrix for GDPR compliance',
    contact: CONTACTS.securityTeam,
    date: d(16, 13, 12),
    unread: false,
    category: 'primary',
    summary: 'The latest matrix redistributes data masking and consent log coordination to avoid duplicate database queries.',
    ask: 'Please confirm if the assigned engineering tasks are feasible within the current sprint workload.',
    attachments: [{ name: 'GDPR_Responsibility_Matrix.pdf', type: 'pdf' }],
  },
  {
    subject: 'Reminder: ISO 27001 Audit readiness',
    contact: CONTACTS.securityTeam,
    date: d(16, 11, 26),
    unread: true,
    category: 'primary',
    summary: 'Several access control policies are expiring this week and need sign-off before the external auditors arrive.',
    ask: 'Please review the IAM roles before Friday to avoid non-compliance during the audit.',
  },
  {
    subject: 'Competitor teardown notes shared by Product Strategy',
    contact: CONTACTS.vpProduct,
    date: d(16, 10, 8),
    unread: false,
    category: 'primary',
    summary: 'Annotated notes now include reverse-engineered details of how the competitor handles real-time flight price caching.',
    ask: 'Go through the highlighted architecture sections before our strategy meeting so discussion time is focused.',
    attachments: [{ name: 'Competitor_Tech_Teardown.pdf', type: 'pdf' }],
  },
  {
    subject: 'Vendor travel reimbursement process for Tech Summit',
    contact: CONTACTS.finOps,
    date: d(16, 9, 35),
    unread: true,
    category: 'primary',
    summary: 'Finance approved a simplified reimbursement flow with one-page claim format for the speakers we invited to our Tech Summit.',
    ask: 'Approve all pending speaker claims by Thursday evening so AP can settle this cycle.',
  },
  {
    subject: '1:1 Mentorship clinic slots confirmation',
    contact: CONTACTS.engLeadership,
    date: d(16, 8, 52),
    unread: false,
    category: 'primary',
    summary: 'High-potential engineering managers shared preferred windows and we mapped them to your availability for 1:1s.',
    ask: 'Confirm your assigned slots or request a reschedule by noon tomorrow.',
  },
  {
    subject: 'SaaS tool auto-renewal reminder',
    contact: CONTACTS.itSupport,
    date: d(16, 8, 15),
    unread: true,
    category: 'primary',
    summary: 'The GitHub Enterprise license renewal threshold alert is active and auto-billing will run tonight.',
    ask: 'Confirm the seat count adjustments if you want to avoid paying for inactive users.',
  },
];

const currentWeekPromotionSingles: SingleSeed[] = [
  {
    subject: 'Exclusive: MacBook Pro M3 Max for Enterprise',
    contact: CONTACTS.apple,
    date: d(18, 11, 2),
    unread: true,
    category: 'promotions',
    summary: 'Apple Enterprise is offering bulk upgrade pricing for your senior engineering staff.',
    ask: 'Contact your account manager before midnight to lock in the 15% discount on the new fleet.',
  },
  {
    subject: 'Taj Corporate: Complimentary Suite Upgrades for Executives',
    contact: CONTACTS.tajhotels,
    date: d(17, 20, 25),
    unread: false,
    category: 'promotions',
    summary: 'As a platinum corporate partner, MMT executives can unlock complimentary suite upgrades on their next business travel.',
    ask: 'Tap to activate your InnerCircle pass for your upcoming trip to Bangalore.',
  },
  {
    subject: 'AWS re:Invent VIP Registration is open',
    contact: CONTACTS.amazon,
    date: d(17, 14, 8),
    unread: true,
    category: 'promotions',
    summary: 'As a top-tier AWS customer, we are holding a VIP suite for your leadership team in Las Vegas.',
    ask: 'Confirm your attendance to secure front-row seating for the keynote.',
  },
  {
    subject: 'Amex Platinum corporate multiplier points',
    contact: CONTACTS.amex,
    date: d(16, 18, 6),
    unread: false,
    category: 'promotions',
    summary: 'Earn 5X points on all corporate cloud infrastructure payments made via your Amex card this month.',
    ask: 'Activate the offer on your dashboard to start accruing multipliers.',
  },
  {
    subject: 'Priority pass: CTO Leadership Retreat early access',
    contact: CONTACTS.tajhotels,
    date: d(16, 13, 42),
    unread: true,
    category: 'promotions',
    summary: 'Taj Corporate has reserved early-access room inventory for executive offsites with bundled boardroom credits.',
    ask: 'Confirm by tonight to lock preferred rates for your leadership retreat dates.',
  },
];

const currentWeekUpdateThreads: ThreadSeed[] = [
  {
    subject: 'HDFC Corporate Account: Payroll funding discrepancy',
    contact: CONTACTS.hdfc,
    date: d(18, 16, 32),
    unread: true,
    category: 'updates',
    size: 3,
    context: 'We noticed one bulk transfer entry showing pending status despite successful debit reflected in the MMT treasury ledger.',
    ask: 'Please confirm the UTR reference from your finance team so our tech desk can patch the API webhook within one working day.',
    close: 'Support has marked this as high priority because it affects contractor payouts.',
  },
  {
    subject: 'Zerodha ESOP margin alert and pledge update',
    contact: CONTACTS.zerodha,
    date: d(18, 14, 58),
    unread: false,
    category: 'updates',
    size: 2,
    context: 'Your pledged MMT ESOP holdings were updated and the available margin now reflects the latest settlement cycle.',
    ask: 'Review the collateral summary and confirm if you want to unpledge any shares before the trading window closes.',
    close: 'Once confirmed, we can avoid auto-square-off.',
  },
  {
    subject: 'LinkedIn: Ex-Google VP interested in VP Engineering role',
    contact: CONTACTS.linkedin,
    date: d(18, 12, 44),
    unread: true,
    starred: true,
    category: 'updates',
    size: 4,
    context: 'An executive candidate from Google responded to our outreach and requested a short vision walkthrough with you this week.',
    ask: 'Please share your available slots so we can coordinate a confidential chat.',
    close: 'I can block a confirmed interview slot as soon as you send your preference.',
  },
  {
    subject: 'Jira workspace permissions for Core Architecture board',
    contact: CONTACTS.jira,
    date: d(17, 18, 34),
    unread: false,
    category: 'updates',
    size: 3,
    context: 'We added the external auditors to the architecture project, but one restricted Epic still needs your approval to open read access.',
    ask: 'Kindly confirm if the auditor group should have full read rights or summary-only permissions.',
    close: 'After your confirmation, permission sync will complete automatically via Okta.',
  },
  {
    subject: 'AWS CloudWatch alert: High latency on Payment Gateway microservice',
    contact: CONTACTS.awsAlerts,
    date: d(17, 15, 26),
    unread: true,
    category: 'updates',
    size: 2,
    context: 'This is an automated alert indicating p99 latency crossed 2.5 seconds for the payment-service-prod cluster.',
    ask: 'Acknowledge this alert so the PagerDuty incident can be routed to the appropriate on-call engineer.',
    close: 'Unacknowledged alerts will escalate to the Director of Engineering in 15 minutes.',
  },
  {
    subject: 'FinOps settlement confirmation for SaaS vendor invoices',
    contact: CONTACTS.finOps,
    date: d(16, 17, 42),
    unread: false,
    category: 'updates',
    size: 3,
    context: 'Three major SaaS invoices (Datadog, Snowflake, GitHub) moved from pending to processed and will reflect in vendor accounts by evening.',
    ask: 'Please verify the cost center tags for one final compliance check before wire transfer release.',
    close: 'After confirmation, settlement receipts will be attached to the NetSuite export.',
  },
];

const currentWeekUpdateSingles: SingleSeed[] = [
  {
    subject: 'HDFC: Corporate credit card payment received',
    contact: CONTACTS.hdfc,
    date: d(18, 11, 16),
    unread: false,
    category: 'updates',
    summary: 'Your recent executive card payment has been posted and the available limit is updated in the corporate dashboard.',
    ask: 'No action needed unless you notice any mismatch in the expense management portal.',
  },
  {
    subject: 'Zerodha daily P&L summary is ready',
    contact: CONTACTS.zerodha,
    date: d(18, 9, 59),
    unread: true,
    category: 'updates',
    summary: 'Your personal equity portfolio closed in green today.',
    ask: 'Review risk meter before placing any fresh leveraged orders tomorrow.',
  },
  {
    subject: 'LinkedIn: Your post on Serverless Architecture is trending',
    contact: CONTACTS.linkedin,
    date: d(17, 21, 12),
    unread: false,
    category: 'updates',
    summary: 'Over 500 engineering leaders have viewed and engaged with your recent article on scaling XYZ Corporation infrastructure.',
    ask: 'Consider replying to the top comments from AWS architects to boost visibility further.',
  },
  {
    subject: 'Jira digest: Sprint 42 closure report',
    contact: CONTACTS.jira,
    date: d(17, 17, 41),
    unread: true,
    category: 'updates',
    summary: '150 story points moved to done across the Flights pod, and 3 critical bugs rolled over to the next sprint.',
    ask: 'Please review the burndown chart and comment on the missed deliverables.',
  },
  {
    subject: 'AWS Maintenance: RDS instance reboot schedule',
    contact: CONTACTS.awsAlerts,
    date: d(17, 13, 37),
    unread: false,
    category: 'updates',
    summary: 'AWS is scheduling a mandatory security patch for your ap-south-1 RDS instances this weekend.',
    ask: 'Update your maintenance windows or the instances will be forcefully rebooted.',
  },
  {
    subject: 'FinOps: Azure vs AWS monthly burn report generated',
    contact: CONTACTS.finOps,
    date: d(17, 9, 8),
    unread: true,
    category: 'updates',
    summary: 'The monthly multi-cloud cost comparison shows a 12% increase in Azure ML compute costs.',
    ask: 'You can review the detailed breakdown in the Tableau dashboard linked below.',
  },
  {
    subject: 'HDFC wealth management report for March',
    contact: CONTACTS.hdfc,
    date: d(16, 19, 24),
    unread: false,
    category: 'updates',
    summary: 'Your relationship manager has uploaded the quarterly portfolio review.',
    ask: 'Download and verify key entries before your scheduled call with the advisor.',
    attachments: [{ name: 'HDFC_Wealth_March.pdf', type: 'pdf' }],
  },
  {
    subject: 'Zerodha: Corporate action on tech sector holdings',
    contact: CONTACTS.zerodha,
    date: d(16, 15, 18),
    unread: true,
    category: 'updates',
    summary: 'A major IT stock in your portfolio announced a buyback and record date information has been posted.',
    ask: 'Please check entitlement details via Console.',
  },
  {
    subject: 'LinkedIn weekly talent pool insights',
    contact: CONTACTS.linkedin,
    date: d(16, 11, 33),
    unread: false,
    category: 'updates',
    summary: 'Your company profile is attracting 30% more Senior Software Engineers this week compared to last month.',
    ask: 'Keep your job postings active to capture this inbound interest.',
  },
];

const previousWeekPrimaryThreads: ThreadSeed[] = [
  {
    subject: 'Last week wrap-up: iOS app crash rate post-mortem',
    contact: CONTACTS.vpEng,
    date: d(14, 18, 10),
    unread: false,
    category: 'primary',
    size: 3,
    context: 'We are closing the previous week incident regarding the iOS 17 app crashes and need your notes on what failed in our QA automation.',
    ask: 'Could you send your retrospective points so we include the CTO perspective in the final board brief?',
    close: 'This will shape how we restructure the mobile release train.',
  },
  {
    subject: 'Last week vendor closeout: Akamai CDN negotiation',
    contact: CONTACTS.awsTeam,
    date: d(13, 17, 28),
    unread: false,
    category: 'primary',
    size: 2,
    context: 'The vendor contract draft includes the updated SLA terms and the volume discount tiers we pushed for.',
    ask: 'Please confirm if the legal redlines are acceptable before we route it to the CFO.',
    close: 'We want to sign this before the quarter ends to lock in the pricing.',
  },
  {
    subject: 'Architecture Council retrospective on micro-frontend rollout',
    contact: CONTACTS.archCouncil,
    date: d(12, 16, 9),
    unread: true,
    category: 'primary',
    size: 3,
    context: 'Last week we saw heavy bundle size regressions across the Holidays pages after the micro-frontend integration.',
    ask: 'Can you review the proposed webpack splitting guidelines before we enforce them in the CI?',
    close: 'Your feedback gives the frontend leads the necessary mandate to refactor.',
  },
  {
    subject: 'Hiring prep: Technical assessment vendor evaluation',
    contact: CONTACTS.talentAcquisition,
    date: d(11, 15, 46),
    unread: false,
    category: 'primary',
    size: 2,
    context: 'The TA team documented recurring feedback from hiring managers regarding the HackerRank vs CodeSignal trial.',
    ask: 'Please share your final verdict on which platform offers better system design testing capabilities.',
    close: 'This input will help us procure the enterprise license for the year.',
  },
];

const previousWeekPrimarySingles: SingleSeed[] = [
  {
    subject: 'Weekly digest: CEO Office highlights from Mar 9-13',
    contact: CONTACTS.ceoOffice,
    date: d(14, 12, 14),
    unread: false,
    category: 'primary',
    summary: 'The digest captures keynote announcements, M&A rumors, and key revenue milestones from the previous week.',
    ask: 'Please review and let us know if any tech integration risks need to be added.',
  },
  {
    subject: 'IT Support: Datacenter server rack decommissioning complete',
    contact: CONTACTS.itSupport,
    date: d(14, 10, 52),
    unread: true,
    category: 'primary',
    summary: 'All legacy bare-metal servers marked for decommissioning last week have now been wiped and powered down.',
    ask: 'Reply only if any application owner reports missing legacy archives.',
  },
  {
    subject: 'InfoSec: Recap on phishing simulation results',
    contact: CONTACTS.securityTeam,
    date: d(13, 11, 6),
    unread: false,
    category: 'primary',
    summary: 'This recap notes that 4% of the engineering staff clicked on the simulated phishing link last week.',
    ask: 'Retain this report to discuss mandatory retraining during the next all-hands.',
  },
  {
    subject: 'Vendor Management: Thank you note from Snowflake',
    contact: CONTACTS.awsTeam,
    date: d(13, 9, 42),
    unread: false,
    category: 'primary',
    summary: 'The Snowflake executive team appreciated the thoughtful architecture feedback provided during the QBR.',
    ask: 'Share any feature requests you want prioritized on their product roadmap.',
  },
  {
    subject: 'SRE Team: Disaster Recovery drill sign-off complete',
    contact: CONTACTS.sreTeam,
    date: d(12, 14, 18),
    unread: true,
    category: 'primary',
    summary: 'The multi-region failover drill logs have been compiled and the RTO/RPO metrics met our compliance targets.',
    ask: 'Sign off on the attached compliance document for the auditors.',
  },
  {
    subject: 'Marketing Tech: CRM migration retrospective metrics',
    contact: CONTACTS.marketingTech,
    date: d(11, 18, 5),
    unread: false,
    category: 'primary',
    summary: 'The retrospective includes data sync latencies, API error rates, and marketer adoption observations from the Salesforce migration.',
    ask: 'Please suggest one architectural improvement for the next phase of the rollout.',
  },
  {
    subject: 'TA Bot: Weekly engineering attrition summary',
    contact: CONTACTS.talentAcquisition,
    date: d(10, 16, 31),
    unread: true,
    category: 'primary',
    summary: 'The HR system flagged a slight uptick in voluntary attrition within the QA automation teams.',
    ask: 'Review the exit interview themes to address potential management or tooling issues.',
  },
  {
    subject: 'FinOps: Month-close cloud ledger exported',
    contact: CONTACTS.finOps,
    date: d(9, 19, 20),
    unread: false,
    category: 'primary',
    summary: 'The prior month cloud billing ledger has been exported with categorized spends for compute, storage, and egress.',
    ask: 'Flag any untagged resources so we can implement chargebacks correctly.',
    attachments: [{ name: 'Cloud_Cost_Ledger.csv', type: 'csv' }],
  },
];

const previousWeekPromotionSingles: SingleSeed[] = [
  {
    subject: 'Last week flashback: Top enterprise hardware deals',
    contact: CONTACTS.apple,
    date: d(14, 9, 2),
    unread: false,
    category: 'promotions',
    summary: 'We compiled your missed bulk-order offers from the previous week in one quick recap.',
    ask: 'Tap if you want alerts only for server hardware going forward.',
  },
  {
    subject: 'Weekend corporate dining pass recap',
    contact: CONTACTS.tajhotels,
    date: d(12, 20, 40),
    unread: true,
    category: 'promotions',
    summary: 'You had access to executive dining discounts during the prior weekend near the corporate office.',
    ask: 'Set your preferences so future CXO event recommendations are more relevant.',
  },
  {
    subject: 'Amex rewards recap for prior week business travel',
    contact: CONTACTS.amex,
    date: d(11, 14, 12),
    unread: false,
    category: 'promotions',
    summary: 'Your prior-week travel bookings qualified for bonus multiplier rewards and lounge credits.',
    ask: 'Review the reward ledger and enroll in auto-apply for future corporate trips.',
  },
];

const previousWeekUpdateThreads: ThreadSeed[] = [
  {
    subject: 'HDFC Corporate API support ticket closure confirmation',
    contact: CONTACTS.hdfc,
    date: d(13, 14, 7),
    unread: false,
    category: 'updates',
    size: 2,
    context: 'Your tech team’s support request regarding the payment gateway API timeout has been resolved.',
    ask: 'Please acknowledge closure if the webhooks are now firing successfully.',
    close: 'We can reopen the case instantly if any 500 errors persist.',
  },
  {
    subject: 'LinkedIn thread on speaking engagement follow-up',
    contact: CONTACTS.linkedin,
    date: d(11, 17, 2),
    unread: true,
    category: 'updates',
    size: 3,
    context: 'The conference organizers need your final topic for the CTO panel discussion next month.',
    ask: 'Share your preferred topic on AI in travel tech or Cloud optimization.',
    close: 'I will confirm your PR abstract once we receive this.',
  },
];

const previousWeekUpdateSingles: SingleSeed[] = [
  {
    subject: 'Zerodha week-end corporate portfolio snapshot',
    contact: CONTACTS.zerodha,
    date: d(14, 16, 44),
    unread: false,
    category: 'updates',
    summary: 'Your ESOP and equity snapshot from last week has been archived.',
    ask: 'Use it as baseline for your tax planning.',
  },
  {
    subject: 'Jira digest archive from previous release',
    contact: CONTACTS.jira,
    date: d(12, 12, 38),
    unread: true,
    category: 'updates',
    summary: 'All resolved tickets from the previous production release were archived and tagged with the version number.',
    ask: 'Please verify that the hotfixes are merged back to the main branch.',
  },
  {
    subject: 'AWS Cost Explorer summary for previous week',
    contact: CONTACTS.awsAlerts,
    date: d(10, 10, 55),
    unread: false,
    category: 'updates',
    summary: 'Your AWS account generated an automated weekly cost and usage report.',
    ask: 'If any anomaly is detected, report it to the FinOps team.',
  },
];

const currentWeekPrimaryEmails = [
  ...currentWeekPrimaryThreads.map(createThreadEmail),
  ...currentWeekPrimarySingles.map(createSingleEmail),
];

const currentWeekPromotionEmails = currentWeekPromotionSingles.map(createSingleEmail);

const currentWeekUpdateEmails = [
  ...currentWeekUpdateThreads.map(createThreadEmail),
  ...currentWeekUpdateSingles.map(createSingleEmail),
];

const previousWeekEmails = [
  ...previousWeekPrimaryThreads.map(createThreadEmail),
  ...previousWeekPrimarySingles.map(createSingleEmail),
  ...previousWeekPromotionSingles.map(createSingleEmail),
  ...previousWeekUpdateThreads.map(createThreadEmail),
  ...previousWeekUpdateSingles.map(createSingleEmail),
];

const allEmails = [
  ...currentWeekPrimaryEmails,
  ...currentWeekPromotionEmails,
  ...currentWeekUpdateEmails,
  ...previousWeekEmails,
];

allEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export const mockEmails: MockEmail[] = allEmails;