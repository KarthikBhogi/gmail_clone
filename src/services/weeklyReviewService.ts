import { Groq } from 'groq-sdk';
import { MockEmail } from './mockData';
import { DEFAULT_WEEKLY_REVIEW_CONFIG, normalizeWeeklyReviewConfig, WeeklyReviewConfig } from './weeklyReviewConfig';

declare const __APP_GROQ_API_KEY__: string | undefined;
declare const __APP_GROQ_API_KEYS__: string[] | undefined;

export interface ExtractedTheme {
  title: string;
  summary: string;
  threadIds: string[];
  hasCriticalAction: boolean;
}

export interface ExtractedAction {
  threadId: string;
  summary: string;
  urgency: 'Critical' | 'High' | 'Medium' | 'Low';
  dueDate?: string;
  confidence: number;
  status?: 'Pending' | 'Resolved' | 'CarryForward' | 'Snoozed' | 'Dismissed';
}

export interface WeeklyReviewData {
  themes: ExtractedTheme[];
  actions: ExtractedAction[];
}

export type ActionDraftMode = 'reply' | 'delegate';

export interface GeneratedActionDraft {
  body: string;
  generatedBy: 'fallback' | 'groq';
  model?: string;
  recipient: string;
  subject: string;
}

interface WeeklyReviewOptions {
  config?: WeeklyReviewConfig;
  referenceNow?: Date | string;
}

interface ActionDraftOptions {
  config?: WeeklyReviewConfig;
  recipientHint?: string;
  referenceNow?: Date | string;
}

type SimplifiedEmailThread = {
  bodySnippet: string;
  date: string;
  id: string;
  latestActivityAt: string;
  messages: Array<{
    body: string;
    date: string;
    sender: string;
  }>;
  sender: string;
  subject: string;
};

const ACTIONABLE_SIGNAL_REGEX = /(action required|approve|approval|review|respond|reply|confirm|submit|deadline|due|follow\s?up|commitment|owner|eta|please|need your|can you|could you|reminder|escalat|blocker|risk|acknowledge|share|send|select|choose|schedule|validate|sign[- ]?off)/i;
const HIGH_IMPORTANCE_SENDER_REGEX = /(ceo|cfo|coo|cto|vp|director|head|legal|finance|controller|board|investor|client|customer|hrbp|chief|executive)/i;
const INFORMATIONAL_DIGEST_REGEX = /(daily p&l|portfolio snapshot|portfolio update|risk meter|week-end|weekend|digest|recap|summary is ready|corporate action|statement|ledger exported|closed in green|reward ledger|cost explorer|notification)/i;
const PASSIVE_SELF_SERVICE_REGEX = /(if any anomaly|if you want|use it as baseline|review risk meter before placing|tap if you want|set your preferences|enroll in auto-apply|retain this report|for your records|for reference only|archived|is ready)/i;
const STRONG_EXECUTIVE_ACTION_REGEX = /(approve|approval|reply|respond|confirm|submit|share|send|provide|sign[- ]?off|acknowledge|choose|select|schedule|delegate|owner|eta|can you|could you|please (approve|confirm|reply|respond|share|send|provide|submit|sign|acknowledge|choose|select|schedule))/i;
const CLOSURE_SIGNAL_REGEX = /(resolved|issue closed|closed out|closure confirmation|sign[- ]?off complete|no further action|required|needed|nothing else needed|done from our end|complete on our side|we can close|we will close|archived and tagged|case has been resolved|support request .* resolved)/i;
const ACKNOWLEDGEMENT_ONLY_REGEX = /(perfect, that helps|thanks for sharing|thanks for the update|noted|for your awareness|for visibility|keep me copied|keep me posted|update the wider executive thread|close the action item|we will update|i will update|once you push|once you send|once you share|when you share)/i;
const WEAK_ACTIONABLE_SIGNAL_REGEX = /(review|check|risk|monitor|read|note|keep handy|use it as|baseline|awareness)/i;
const AUTOMATED_SENDER_REGEX = /(alerts?@|no-?reply|noreply|notifications?|console|digest|updates?|mailer|team network|linkedin|jira@|cloudwatch|zerodha)/i;
const DIRECT_EXECUTIVE_REQUEST_REGEX = /(please (approve|confirm|reply|respond|share|send|provide|submit|sign|acknowledge|choose|select|schedule|join|review)|can you|could you|need your|awaiting your|your approval|your sign[- ]?off|your response|decision needed|reply by|confirm by|approve by|owner needed|please weigh in|please advise|please decide)/i;
const OPTIONAL_NUDGE_REGEX = /(consider|you may|you can|if helpful|if useful|might want to|could boost|boost visibility|top comments|trending|viewed and engaged|check .* via|details via|view .* in|open .* console|learn more)/i;
const SOCIAL_ENGAGEMENT_REGEX = /(linkedin|top comments|boost visibility|trending|viewed and engaged|engaged with your post|likes|comments)/i;
const SELF_SERVICE_FINANCE_REGEX = /(portfolio|equity|holdings|buyback|record date|corporate action|entitlement details|risk meter|p&l|statement|ledger|reward|wealth|cost explorer)/i;
const USER_IDENTITY_REGEX = /rahul mehta|rahul/i;
const MAX_THEME_COUNT = 6;
// GPT-first model routing: try all configured keys on GPT, then move to secondary models.
const PRIMARY_GPT_MODEL = 'openai/gpt-oss-120b' as const;
const SECONDARY_MODEL_FALLBACKS = [
  'openai/gpt-oss-20b',
  'qwen/qwen3-32b',
  'llama-3.1-8b-instant',
] as const;
const GROQ_MODEL_FALLBACKS = [PRIMARY_GPT_MODEL, ...SECONDARY_MODEL_FALLBACKS] as const;
const THEME_STOP_WORDS = new Set([
  'about', 'after', 'also', 'an', 'and', 'any', 'are', 'back', 'before', 'best', 'by', 'can', 'could', 'date', 'details',
  'email', 'emails', 'for', 'from', 'further', 'have', 'hello', 'here', 'hi', 'if', 'in', 'into', 'is', 'it', 'its', 'just',
  'latest', 'me', 'more', 'need', 'next', 'not', 'now', 'our', 'please', 'rahul', 'regards', 'reply', 'review', 'send',
  'share', 'should', 'team', 'thanks', 'that', 'the', 'their', 'there', 'these', 'this', 'those', 'through', 'today',
  'tomorrow', 'update', 'updates', 'via', 'want', 'we', 'week', 'weekly', 'when', 'with', 'you', 'your',
]);
const THEME_TOKEN_ALIASES: Record<string, string> = {
  approvals: 'approval',
  approving: 'approval',
  architects: 'architecture',
  architectural: 'architecture',
  budgets: 'budget',
  campaigns: 'campaign',
  costs: 'cost',
  customers: 'customer',
  deployments: 'deployment',
  escalations: 'escalation',
  finances: 'finance',
  incidents: 'incident',
  interviews: 'interview',
  migrations: 'migration',
  metrics: 'metric',
  outages: 'outage',
  payments: 'payment',
  promotions: 'promotion',
  rollouts: 'rollout',
  securities: 'security',
  signoff: 'approval',
  signoffs: 'approval',
  stakeholders: 'stakeholder',
};

type ThemeCluster = {
  emailIds: string[];
  senderCounts: Map<string, number>;
  tokenCounts: Map<string, number>;
};

function titleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function getThreadText(email: MockEmail): string {
  return [
    email.subject,
    email.snippet,
    email.sender,
    ...email.messages.map((message) => `${message.sender} ${message.body}`),
  ].join(' ');
}

function getPrimarySenderName(sender: string): string {
  const display = sender.split('<')[0]?.trim() || sender.trim();
  const first = display.split(/\s+/)[0]?.trim();
  return first || 'there';
}

function getLatestThreadTimestamp(email: MockEmail): number {
  const baseTs = new Date(email.date).getTime();
  return email.messages.reduce((latest, message) => {
    const messageTs = new Date(message.date).getTime();
    if (Number.isNaN(messageTs)) {
      return latest;
    }
    return Math.max(latest, messageTs);
  }, Number.isNaN(baseTs) ? 0 : baseTs);
}

function resolveReferenceNowMs(referenceNow?: Date | string): number {
  if (referenceNow instanceof Date) {
    const timestamp = referenceNow.getTime();
    return Number.isNaN(timestamp) ? Date.now() : timestamp;
  }

  if (typeof referenceNow === 'string') {
    const timestamp = new Date(referenceNow).getTime();
    return Number.isNaN(timestamp) ? Date.now() : timestamp;
  }

  return Date.now();
}

function getEffectiveReviewConfig(config?: WeeklyReviewConfig): WeeklyReviewConfig {
  return normalizeWeeklyReviewConfig(config ?? DEFAULT_WEEKLY_REVIEW_CONFIG);
}

function getConfiguredGroqApiKeys(): string[] {
  const bundledGroqApiKeys = Array.isArray(__APP_GROQ_API_KEYS__)
    ? __APP_GROQ_API_KEYS__.map((key) => key.trim()).filter(Boolean)
    : [];
  const legacyBundledKey = typeof __APP_GROQ_API_KEY__ === 'string' ? __APP_GROQ_API_KEY__.trim() : '';
  const localStorageKeys = ['groq_api_key', 'groq_api_key_2', 'groq_api_key_3']
    .map((key) => localStorage.getItem(key)?.trim())
    .filter((key): key is string => Boolean(key));

  return Array.from(new Set([legacyBundledKey, ...bundledGroqApiKeys, ...localStorageKeys].filter(Boolean)));
}

function getLatestExternalMessage(email: MockEmail): MockEmail['messages'][number] | undefined {
  const externalMessages = email.messages.filter((message) => !USER_IDENTITY_REGEX.test(message.sender));
  return externalMessages[externalMessages.length - 1];
}

function getLatestUserMessage(email: MockEmail): MockEmail['messages'][number] | undefined {
  const userMessages = email.messages.filter((message) => USER_IDENTITY_REGEX.test(message.sender));
  return userMessages[userMessages.length - 1];
}

function isAutomatedSender(sender: string): boolean {
  return AUTOMATED_SENDER_REGEX.test(sender);
}

function hasDirectExecutiveRequest(email: MockEmail, candidateText = ''): boolean {
  const latestExternal = getLatestExternalMessage(email);
  const combinedText = `${candidateText} ${email.subject} ${email.snippet} ${latestExternal?.body ?? ''}`.replace(/\s+/g, ' ').trim();
  return DIRECT_EXECUTIVE_REQUEST_REGEX.test(combinedText) || STRONG_EXECUTIVE_ACTION_REGEX.test(combinedText);
}

function isLowLeverageExecutivePrompt(email: MockEmail, candidateText = ''): boolean {
  const latestExternal = getLatestExternalMessage(email);
  const senderText = `${email.sender} ${latestExternal?.sender ?? ''}`;
  const combinedText = `${candidateText} ${email.subject} ${email.snippet} ${latestExternal?.body ?? ''}`.replace(/\s+/g, ' ').trim();
  const automatedSender = isAutomatedSender(senderText);
  const directRequest = hasDirectExecutiveRequest(email, candidateText);

  if (SOCIAL_ENGAGEMENT_REGEX.test(combinedText)) {
    return true;
  }

  if (automatedSender && OPTIONAL_NUDGE_REGEX.test(combinedText) && !directRequest) {
    return true;
  }

  if (automatedSender && SELF_SERVICE_FINANCE_REGEX.test(combinedText) && !directRequest) {
    return true;
  }

  return false;
}

function isInformationalNotification(email: MockEmail): boolean {
  const latestExternal = getLatestExternalMessage(email);
  const latestExternalText = `${email.subject} ${email.snippet} ${latestExternal?.body ?? ''}`;
  const fullThreadText = getThreadText(email);

  if (hasDirectExecutiveRequest(email, latestExternalText) && !isLowLeverageExecutivePrompt(email, latestExternalText)) {
    return false;
  }

  if (PASSIVE_SELF_SERVICE_REGEX.test(latestExternalText)) {
    return true;
  }

  if (isLowLeverageExecutivePrompt(email, latestExternalText)) {
    return true;
  }

  if (INFORMATIONAL_DIGEST_REGEX.test(fullThreadText) && /alerts@|noreply|no-reply|console|cloudwatch|bank alerts|rewards@|jira@|linkedin/i.test(email.sender)) {
    return true;
  }

  if (/(portfolio|equity|esop|leveraged orders|risk meter|reward|cost explorer|corporate action)/i.test(fullThreadText) && !STRONG_EXECUTIVE_ACTION_REGEX.test(fullThreadText)) {
    return true;
  }

  return false;
}

function isClosedOrAcknowledgedThread(email: MockEmail): boolean {
  const latestExternal = getLatestExternalMessage(email);
  if (!latestExternal) {
    return false;
  }

  const latestExternalText = `${email.subject} ${latestExternal.body}`.replace(/\s+/g, ' ').trim();
  if (STRONG_EXECUTIVE_ACTION_REGEX.test(latestExternalText)) {
    return false;
  }

  if (CLOSURE_SIGNAL_REGEX.test(latestExternalText)) {
    return true;
  }

  if (ACKNOWLEDGEMENT_ONLY_REGEX.test(latestExternalText) && !STRONG_EXECUTIVE_ACTION_REGEX.test(latestExternalText)) {
    return true;
  }

  return false;
}

function isPendingForUser(email: MockEmail, referenceNowMs: number): boolean {
  const latestExternal = getLatestExternalMessage(email);
  if (!latestExternal) {
    return false;
  }

  const latestUser = getLatestUserMessage(email);
  const latestExternalTs = new Date(latestExternal.date).getTime();
  const latestUserTs = latestUser ? new Date(latestUser.date).getTime() : Number.NEGATIVE_INFINITY;
  const latestMessage = email.messages[email.messages.length - 1];
  const latestMessageIsExternal = Boolean(latestMessage) && !USER_IDENTITY_REGEX.test(latestMessage.sender);
  const actionableLatestContext = ACTIONABLE_SIGNAL_REGEX.test(`${email.subject} ${email.snippet} ${latestExternal.body}`);
  const urgency = detectUrgency(email, referenceNowMs);

  if (Number.isNaN(latestExternalTs)) {
    return false;
  }

  if (isInformationalNotification(email)) {
    return false;
  }

  if (isClosedOrAcknowledgedThread(email)) {
    return false;
  }

  if (isLowLeverageExecutivePrompt(email)) {
    return false;
  }

  if (!actionableLatestContext && (urgency === 'Low' || WEAK_ACTIONABLE_SIGNAL_REGEX.test(`${email.subject} ${latestExternal.body}`))) {
    return false;
  }

  if (latestUser && !Number.isNaN(latestUserTs) && latestUserTs >= latestExternalTs) {
    return false;
  }

  if (!latestMessageIsExternal && latestUser) {
    return false;
  }

  return true;
}

function sentenceFromText(text: string): string | null {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const best = sentences.find((sentence) => ACTIONABLE_SIGNAL_REGEX.test(sentence));
  if (best) {
    return best;
  }

  return sentences[0] ?? null;
}

function normalizeSummaryText(text: string): string {
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/^(please|kindly)\s+/i, '')
    .replace(/[.?!]+$/, '')
    .trim();

  if (!cleaned) {
    return 'Review this email';
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function extractActionVerb(text: string): string {
  if (/(approve|approval|sign[- ]?off)/i.test(text)) return 'Approve';
  if (/(reply|respond)/i.test(text)) return 'Reply to';
  if (/(confirm|acknowledge)/i.test(text)) return 'Confirm';
  if (/(review|validate|check)/i.test(text)) return 'Review';
  if (/(share|send|provide)/i.test(text)) return 'Share';
  if (/(schedule|slot|calendar|meeting)/i.test(text)) return 'Schedule';
  if (/(choose|select)/i.test(text)) return 'Choose';
  return 'Follow up on';
}

function inferDueDate(email: MockEmail): string | undefined {
  const referenceDate = new Date(getLatestThreadTimestamp(email));
  const text = getThreadText(email).toLowerCase();

  if (Number.isNaN(referenceDate.getTime())) {
    return undefined;
  }

  if (/today|tonight|eod|end of day/.test(text)) {
    const due = new Date(referenceDate);
    due.setHours(18, 0, 0, 0);
    return due.toISOString();
  }

  if (/tomorrow/.test(text)) {
    const due = new Date(referenceDate);
    due.setDate(due.getDate() + 1);
    due.setHours(18, 0, 0, 0);
    return due.toISOString();
  }

  if (/next week/.test(text)) {
    const due = new Date(referenceDate);
    due.setDate(due.getDate() + 7);
    due.setHours(12, 0, 0, 0);
    return due.toISOString();
  }

  return undefined;
}

function detectUrgency(email: MockEmail, referenceNowMs: number): ExtractedAction['urgency'] {
  const text = getThreadText(email).toLowerCase();
  const sender = `${email.sender}`.toLowerCase();
  const threadActivity = email.messages.length;
  const latestActivity = getLatestThreadTimestamp(email);
  const recentActivity = latestActivity > 0 && referenceNowMs - latestActivity <= 48 * 60 * 60 * 1000;

  if (/(urgent|asap|overdue|today|immediately|final reminder|deadline|escalat|p1|critical)/.test(text)) return 'Critical';
  if (/(due|tomorrow|action required|payment|submit|review|approve|approval|sign[- ]?off|blocker|acknowledge)/.test(text)) return 'High';
  if (HIGH_IMPORTANCE_SENDER_REGEX.test(sender) && (threadActivity >= 2 || recentActivity)) return 'High';
  if (threadActivity >= 4 && /(follow up|request|confirm|pending|owner|eta)/.test(text)) return 'High';
  if (/(update|please|request|confirm|follow up|check|coordinate|share|send|choose|schedule)/.test(text)) return 'Medium';
  return 'Low';
}

function isActionableThread(email: MockEmail, referenceNowMs: number, config: WeeklyReviewConfig): boolean {
  const text = getThreadText(email);
  const urgency = detectUrgency(email, referenceNowMs);
  const directRequest = hasDirectExecutiveRequest(email);
  const officialSender = isOfficialSender(email, config);

  if (!isPendingForUser(email, referenceNowMs)) {
    return false;
  }

  if (isLowLeverageExecutivePrompt(email)) {
    return false;
  }

  if (directRequest) {
    return true;
  }

  return (!isAutomatedSender(email.sender) || officialSender) &&
    (ACTIONABLE_SIGNAL_REGEX.test(text) || urgency === 'Critical' || urgency === 'High' || (officialSender && urgency === 'Medium'));
}

function buildActionSummary(email: MockEmail): string {
  const latestExternal = getLatestExternalMessage(email);
  const candidateText = latestExternal?.body || email.snippet || email.subject;
  const extractedSentence = sentenceFromText(candidateText);
  if (extractedSentence) {
    return normalizeSummaryText(extractedSentence);
  }

  const verb = extractActionVerb(getThreadText(email));
  return `${verb} ${email.subject}`.trim();
}

function normalizeThemeToken(rawToken: string): string | null {
  const normalized = rawToken.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!normalized || normalized.length < 3 || /\d/.test(normalized)) {
    return null;
  }

  const aliased = THEME_TOKEN_ALIASES[normalized] ?? normalized;
  if (THEME_STOP_WORDS.has(aliased)) {
    return null;
  }

  return aliased;
}

function getSenderOrganization(sender: string): string | null {
  const emailMatch = sender.match(/@([a-z0-9-]+)\./i);
  if (emailMatch?.[1]) {
    const normalized = normalizeThemeToken(emailMatch[1]);
    if (normalized && !['gmail', 'outlook', 'google', 'mail'].includes(normalized)) {
      return normalized;
    }
  }

  const displayName = sender.split('<')[0]?.trim();
  if (!displayName) {
    return null;
  }

  const tokens = displayName
    .split(/\s+/)
    .map(normalizeThemeToken)
    .filter((token): token is string => Boolean(token));

  return tokens[0] ?? null;
}

function isOfficialSender(email: MockEmail, config: WeeklyReviewConfig): boolean {
  const configuredList = config.officialEmailList.map((entry) => entry.toLowerCase()).filter(Boolean);
  if (configuredList.length === 0) {
    return false;
  }

  const senderText = `${email.sender} ${email.messages.map((message) => message.sender).join(' ')}`.toLowerCase();
  return configuredList.some((entry) => senderText.includes(entry));
}

function extractThemeTokensForEmail(email: MockEmail): string[] {
  const latestExternal = getLatestExternalMessage(email);
  const text = `${email.subject} ${email.snippet} ${latestExternal?.body ?? ''}`;
  const tokens = text
    .split(/[^a-zA-Z0-9]+/)
    .map(normalizeThemeToken)
    .filter((token): token is string => Boolean(token));

  const uniqueTokens = Array.from(new Set(tokens));
  const subjectTokens = email.subject
    .split(/[^a-zA-Z0-9]+/)
    .map(normalizeThemeToken)
    .filter((token): token is string => Boolean(token));

  return Array.from(new Set([...subjectTokens, ...uniqueTokens])).slice(0, 10);
}

function createThemeCluster(email: MockEmail): ThemeCluster {
  const tokenCounts = new Map<string, number>();
  extractThemeTokensForEmail(email).forEach((token) => {
    tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
  });

  const senderCounts = new Map<string, number>();
  const senderOrg = getSenderOrganization(email.sender);
  if (senderOrg) {
    senderCounts.set(senderOrg, 1);
  }

  return {
    emailIds: [email.id],
    senderCounts,
    tokenCounts,
  };
}

function addEmailToThemeCluster(cluster: ThemeCluster, email: MockEmail): ThemeCluster {
  const nextCluster: ThemeCluster = {
    emailIds: [...cluster.emailIds, email.id],
    senderCounts: new Map(cluster.senderCounts),
    tokenCounts: new Map(cluster.tokenCounts),
  };

  extractThemeTokensForEmail(email).forEach((token) => {
    nextCluster.tokenCounts.set(token, (nextCluster.tokenCounts.get(token) ?? 0) + 1);
  });

  const senderOrg = getSenderOrganization(email.sender);
  if (senderOrg) {
    nextCluster.senderCounts.set(senderOrg, (nextCluster.senderCounts.get(senderOrg) ?? 0) + 1);
  }

  return nextCluster;
}

function mergeThemeClusters(target: ThemeCluster, source: ThemeCluster): ThemeCluster {
  const merged: ThemeCluster = {
    emailIds: [...target.emailIds, ...source.emailIds],
    senderCounts: new Map(target.senderCounts),
    tokenCounts: new Map(target.tokenCounts),
  };

  source.tokenCounts.forEach((count, token) => {
    merged.tokenCounts.set(token, (merged.tokenCounts.get(token) ?? 0) + count);
  });

  source.senderCounts.forEach((count, sender) => {
    merged.senderCounts.set(sender, (merged.senderCounts.get(sender) ?? 0) + count);
  });

  return merged;
}

function getTopClusterTokens(cluster: ThemeCluster, limit = 4): string[] {
  return Array.from(cluster.tokenCounts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([token]) => token);
}

function scoreClusterMatch(email: MockEmail, cluster: ThemeCluster): number {
  const emailTokens = extractThemeTokensForEmail(email);
  const clusterTokens = new Set(getTopClusterTokens(cluster, 6));
  const overlap = emailTokens.filter((token) => clusterTokens.has(token)).length;
  const senderOrg = getSenderOrganization(email.sender);
  const senderBonus = senderOrg && cluster.senderCounts.has(senderOrg) ? 1 : 0;
  return overlap * 2 + senderBonus;
}

function scoreClusterMerge(left: ThemeCluster, right: ThemeCluster): number {
  const leftTokens = new Set(getTopClusterTokens(left, 6));
  const rightTokens = new Set(getTopClusterTokens(right, 6));
  const overlap = Array.from(leftTokens).filter((token) => rightTokens.has(token)).length;
  const sharedSender = Array.from(left.senderCounts.keys()).some((sender) => right.senderCounts.has(sender)) ? 1 : 0;
  return overlap * 2 + sharedSender;
}

function buildDynamicThemeTitle(cluster: ThemeCluster, config: WeeklyReviewConfig): string {
  const topTokens = getTopClusterTokens(cluster, 3).map((token) => titleCase(token));
  const clusterTokens = new Set(getTopClusterTokens(cluster, 6));
  const hintedTitle = config.defaultThemeHints.find((hint) => {
    const hintTokens = hint
      .split(/[^a-zA-Z0-9]+/)
      .map(normalizeThemeToken)
      .filter((token): token is string => Boolean(token));

    return hintTokens.some((token) => clusterTokens.has(token));
  });

  if (hintedTitle) {
    return hintedTitle;
  }

  if (topTokens.length >= 2) {
    return `${topTokens[0]} & ${topTokens[1]}`;
  }

  if (topTokens.length === 1) {
    return `${topTokens[0]} Updates`;
  }

  const sender = Array.from(cluster.senderCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0];
  return sender ? `${titleCase(sender)} Updates` : 'General Updates';
}

function buildThemeClusters(emails: MockEmail[]): ThemeCluster[] {
  const sortedEmails = [...emails].sort((a, b) => getLatestThreadTimestamp(b) - getLatestThreadTimestamp(a));
  let clusters: ThemeCluster[] = [];

  sortedEmails.forEach((email) => {
    const bestMatch = clusters.reduce<{ index: number; score: number }>(
      (best, cluster, index) => {
        const score = scoreClusterMatch(email, cluster);
        if (score > best.score) {
          return { index, score };
        }

        return best;
      },
      { index: -1, score: 0 },
    );

    if (bestMatch.index >= 0 && bestMatch.score >= 2) {
      clusters = clusters.map((cluster, index) => (
        index === bestMatch.index ? addEmailToThemeCluster(cluster, email) : cluster
      ));
      return;
    }

    clusters = [...clusters, createThemeCluster(email)];
  });

  while (clusters.length > MAX_THEME_COUNT) {
    const overflowCluster = clusters[clusters.length - 1];
    const mergeTargetIndex = clusters
      .slice(0, -1)
      .reduce<{ index: number; score: number }>(
        (best, cluster, index) => {
          const score = scoreClusterMerge(cluster, overflowCluster);
          if (score > best.score) {
            return { index, score };
          }

          return best;
        },
        { index: 0, score: Number.NEGATIVE_INFINITY },
      ).index;

    clusters = clusters
      .slice(0, -1)
      .map((cluster, index) => (index === mergeTargetIndex ? mergeThemeClusters(cluster, overflowCluster) : cluster));
  }

  return clusters;
}

function buildContextualThemes(emails: MockEmail[], actions: ExtractedAction[], config: WeeklyReviewConfig): ExtractedTheme[] {
  const actionThreadIds = new Set(actions.map((action) => action.threadId));
  const emailById = new Map(emails.map((email) => [email.id, email]));

  return buildThemeClusters(emails)
    .map((cluster) => {
      const themeEmails = cluster.emailIds
        .map((id) => emailById.get(id))
        .filter((email): email is MockEmail => Boolean(email))
        .sort((a, b) => getLatestThreadTimestamp(b) - getLatestThreadTimestamp(a));
      const threadIds = themeEmails.map((email) => email.id);
      const themeActions = actions.filter((action) => threadIds.includes(action.threadId));

      return {
        title: buildDynamicThemeTitle(cluster, config),
        summary: buildThemeSummary(themeEmails, themeActions.length),
        threadIds,
        hasCriticalAction: themeActions.some((action) => action.urgency === 'Critical'),
      };
    })
    .sort((left, right) => {
      const leftNeedsAction = left.threadIds.some((threadId) => actionThreadIds.has(threadId));
      const rightNeedsAction = right.threadIds.some((threadId) => actionThreadIds.has(threadId));
      if (leftNeedsAction !== rightNeedsAction) {
        return Number(rightNeedsAction) - Number(leftNeedsAction);
      }

      return right.threadIds.length - left.threadIds.length;
    })
    .slice(0, MAX_THEME_COUNT);
}

function buildThemeSummary(emails: MockEmail[], actionCount: number): string {
  const unreadCount = emails.filter((email) => email.unread).length;
  const topSubjects = [...emails]
    .sort((a, b) => getLatestThreadTimestamp(b) - getLatestThreadTimestamp(a))
    .slice(0, 2)
    .map((email) => `"${email.subject}"`);
  const topSenders = Array.from(
    new Set(
      emails
        .map((email) => email.sender.split('<')[0]?.trim() || email.sender)
        .filter(Boolean),
    ),
  )
    .slice(0, 2)
    .join(' and ');

  const highlights = topSubjects.length > 0 ? `Key emails include ${topSubjects.join(' and ')}.` : '';
  return `${emails.length} email${emails.length === 1 ? '' : 's'}, ${unreadCount} unread, and ${actionCount} actionable item${actionCount === 1 ? '' : 's'} from ${topSenders || 'recent senders'}. ${highlights}`.trim();
}

function simplifyEmails(emails: MockEmail[]): SimplifiedEmailThread[] {
  return emails.map((email) => ({
    id: email.id,
    subject: email.subject,
    sender: email.sender,
    date: email.date,
    latestActivityAt: new Date(getLatestThreadTimestamp(email)).toISOString(),
    bodySnippet: email.snippet,
    messages: email.messages.slice(-3).map((message) => ({
      sender: message.sender,
      date: message.date,
      body: message.body ? message.body.substring(0, 500) + (message.body.length > 500 ? '...' : '') : '',
    })),
  }));
}

function buildAiExtractionPrompt(simplifiedEmails: SimplifiedEmailThread[], config: WeeklyReviewConfig): string {
  return `
    You are an intelligent email assistant. Analyze the following email threads and extract:
    1. Key themes (clusters of related emails).
    2. Action items (tasks the user needs to do).

    The user is a time-constrained executive. Only surface actions that genuinely require their decision, approval, reply, delegation, or follow-up this week.
    Preferred theme hints: ${config.defaultThemeHints.length > 0 ? config.defaultThemeHints.join(', ') : 'Use concise business topic names based on the emails.'}
    Additional categorization guidance: ${config.customPromptGuidance || 'None provided.'}

    Email threads:
    ${JSON.stringify(simplifiedEmails, null, 2)}

    For themes:
    - Group related threads into mutually exclusive themes.
    - Return no more than 6 themes total.
    - Provide a title and a short summary for each theme.
    - List the threadIds associated with the theme.
    - Indicate if any action in this theme is critical.

    For action items:
    - Extract only explicit or strongly implied tasks for the user.
    - Only include actions that are still pending for the user.
    - Prefer the latest message context when the thread has multiple replies.
    - Exclude self-service alerts, read-only summaries, portfolio notifications, marketing emails, and system digests unless the executive must explicitly reply, approve, confirm, send something, or make a decision.
    - Exclude optional suggestions, social engagement nudges, "consider replying" prompts, and any "check/view details in console" prompts from automated systems.
    - Exclude anything that can be safely ignored without business consequence this week.
    - Assign an urgency level: Critical, High, Medium, Low.
    - Provide a short summary.
    - Include the threadId.
    - Include a due date if mentioned (ISO format).
    - Provide a confidence score (0-100).

    Return only valid JSON with this shape:
    {
      "themes": [
        { "title": "string", "summary": "string", "threadIds": ["string"], "hasCriticalAction": true }
      ],
      "actions": [
        { "threadId": "string", "summary": "string", "urgency": "Critical|High|Medium|Low", "dueDate": "optional ISO string", "confidence": 0 }
      ]
    }
  `;
}

function buildFallbackActionDraft(
  email: MockEmail,
  action: Pick<ExtractedAction, 'summary' | 'urgency'>,
  mode: ActionDraftMode,
  recipientHint?: string,
): GeneratedActionDraft {
  const recipient = mode === 'reply'
    ? email.sender
    : recipientHint?.trim() || 'Chief of Staff';
  const senderName = getPrimarySenderName(email.sender);

  if (mode === 'reply') {
    return {
      recipient,
      subject: `Re: ${email.subject}`,
      body: `Hi ${senderName},\n\nThanks for the update. I have reviewed this and will move forward on ${action.summary.toLowerCase()}.\n\nPlease keep me posted on any blockers or decisions needed from my side.\n\nBest,\nRahul`,
      generatedBy: 'fallback',
    };
  }

  return {
    recipient,
    subject: `Please take point on: ${email.subject}`,
    body: `Hi,\n\nPlease take ownership of this and close the loop today.\n\nContext: ${email.subject}\nRequested action: ${action.summary}\n\nPlease send me a short status update once done or flag if you need my decision.\n\nThanks,\nRahul`,
    generatedBy: 'fallback',
  };
}

function buildActionDraftPrompt(
  email: MockEmail,
  action: Pick<ExtractedAction, 'summary' | 'urgency' | 'dueDate'>,
  mode: ActionDraftMode,
  recipientHint: string,
  referenceNowMs: number,
  config: WeeklyReviewConfig,
): string {
  const latestMessages = email.messages.slice(-4).map((message) => ({
    sender: message.sender,
    date: message.date,
    body: message.body ? message.body.substring(0, 700) : '',
  }));

  return `
    You write crisp executive email drafts.
    Current review date: ${new Date(referenceNowMs).toISOString()}
    Additional drafting guidance: ${config.customPromptGuidance || 'Keep drafts concise and action-oriented.'}

    Draft mode: ${mode === 'reply' ? 'Reply inline to the sender' : 'Delegate the action to an internal teammate'}
    Email subject: ${email.subject}
    Email sender: ${email.sender}
    Suggested recipient: ${recipientHint}
    Action summary: ${action.summary}
    Action urgency: ${action.urgency}
    Due date: ${action.dueDate || 'Not specified'}
    Latest messages:
    ${JSON.stringify(latestMessages, null, 2)}

    Requirements:
    - Keep the draft under 120 words.
    - Be direct, polished, and executive-friendly.
    - Do not invent facts, commitments, or dates not present in the thread.
    - If context is incomplete, acknowledge it briefly and ask for the specific next step.
    - For delegate drafts, clearly ask the teammate to own the follow-through and report back.
    - Return only valid JSON.

    JSON shape:
    {
      "recipient": "string",
      "subject": "string",
      "body": "string"
    }
  `;
}

function parseActionDraftPayload(content: string): GeneratedActionDraft | null {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    const parsed = JSON.parse(withoutFence) as Record<string, unknown>;
    if (typeof parsed.recipient !== 'string' || typeof parsed.subject !== 'string' || typeof parsed.body !== 'string') {
      return null;
    }

    return {
      recipient: parsed.recipient.trim(),
      subject: parsed.subject.trim(),
      body: parsed.body.trim(),
      generatedBy: 'groq',
    };
  } catch {
    return null;
  }
}

function normalizeWeeklyReviewData(emails: MockEmail[], data: WeeklyReviewData, referenceNowMs: number, config: WeeklyReviewConfig): WeeklyReviewData {
  const emailById = new Map(emails.map((email) => [email.id, email]));
  const urgencyOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };

  const actions = data.actions
    .filter((action) => {
      const email = emailById.get(action.threadId);
      return Boolean(email) && isActionableThread(email, referenceNowMs, config) && !isLowLeverageExecutivePrompt(email, action.summary);
    })
    .map((action) => ({
      ...action,
      summary: normalizeSummaryText(action.summary),
    }))
    .sort((a, b) => {
      const urgencyDelta = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDelta !== 0) {
        return urgencyDelta;
      }

      const latestDelta = getLatestThreadTimestamp(emailById.get(b.threadId)!) - getLatestThreadTimestamp(emailById.get(a.threadId)!);
      if (latestDelta !== 0) {
        return latestDelta;
      }

      return a.threadId.localeCompare(b.threadId);
    });

  return {
    themes: buildContextualThemes(emails, actions, config),
    actions,
  };
}

function buildDeterministicWeeklyReview(emails: MockEmail[], referenceNowMs: number, config: WeeklyReviewConfig): WeeklyReviewData {
  const sortedEmails = [...emails].sort((a, b) => getLatestThreadTimestamp(b) - getLatestThreadTimestamp(a));
  const actionsByThreadId = new Map<string, ExtractedAction>();
  sortedEmails.forEach((email) => {
    if (!isActionableThread(email, referenceNowMs, config)) {
      return;
    }

    const urgency = detectUrgency(email, referenceNowMs);
    const summary = buildActionSummary(email);
    const dueDate = inferDueDate(email);
    const confidence = urgency === 'Critical' ? 92 : urgency === 'High' ? 84 : urgency === 'Medium' ? 76 : 68;

    actionsByThreadId.set(email.id, {
      threadId: email.id,
      summary,
      urgency,
      dueDate,
      confidence,
      status: 'Pending' as const,
    });
  });

  return normalizeWeeklyReviewData(emails, {
    themes: [],
    actions: Array.from(actionsByThreadId.values()),
  }, referenceNowMs, config);
}

function parseWeeklyReviewPayload(content: string): WeeklyReviewData | null {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    return JSON.parse(withoutFence) as WeeklyReviewData;
  } catch {
    return null;
  }
}

async function extractWeeklyReviewDataWithGroq(
  emails: MockEmail[],
  apiKeys: string[],
  referenceNowMs: number,
  config: WeeklyReviewConfig,
): Promise<WeeklyReviewData> {
  const simplifiedEmails = simplifyEmails(emails);
  const prompt = `Reference date for review: ${new Date(referenceNowMs).toISOString()}\n\n${buildAiExtractionPrompt(simplifiedEmails, config)}`;
  let lastError: unknown;

  for (const model of GROQ_MODEL_FALLBACKS) {
    for (let index = 0; index < apiKeys.length; index += 1) {
      try {
        const groq = new Groq({
          apiKey: apiKeys[index],
          dangerouslyAllowBrowser: true,
        });

        const response = await groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'You are a structured email review assistant. Return only JSON and no markdown.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          model,
          temperature: 0,
          max_completion_tokens: 2048,
          top_p: 1,
          stream: false,
        });

        const text = response.choices[0]?.message?.content;
        if (!text) {
          console.warn(`Weekly review: Groq model ${model} with key ${index + 1} returned an empty response.`);
          continue;
        }

        const parsed = parseWeeklyReviewPayload(text);
        if (!parsed) {
          console.warn(`Weekly review: Groq model ${model} with key ${index + 1} returned invalid JSON, trying next key or fallback.`);
          continue;
        }

        console.info(`Weekly review: Groq model ${model} succeeded using key ${index + 1}.`);
        return normalizeWeeklyReviewData(emails, parsed, referenceNowMs, config);
      } catch (error) {
        lastError = error;
        console.warn(`Weekly review: Groq model ${model} failed on key ${index + 1}, trying next key or fallback.`, error);
      }
    }
  }

  throw lastError ?? new Error('All configured Groq models failed to return review data.');
}

async function generateActionDraftWithGroq(
  email: MockEmail,
  action: Pick<ExtractedAction, 'summary' | 'urgency' | 'dueDate'>,
  mode: ActionDraftMode,
  apiKeys: string[],
  referenceNowMs: number,
  config: WeeklyReviewConfig,
  recipientHint?: string,
): Promise<GeneratedActionDraft> {
  const suggestedRecipient = recipientHint?.trim() || (mode === 'reply' ? email.sender : 'Chief of Staff');
  const prompt = buildActionDraftPrompt(email, action, mode, suggestedRecipient, referenceNowMs, config);
  let lastError: unknown;

  for (const model of GROQ_MODEL_FALLBACKS) {
    for (let index = 0; index < apiKeys.length; index += 1) {
      try {
        const groq = new Groq({
          apiKey: apiKeys[index],
          dangerouslyAllowBrowser: true,
        });

        const response = await groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'You are a structured drafting assistant. Return only JSON and no markdown.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          model,
          temperature: 0.2,
          max_completion_tokens: 512,
          top_p: 1,
          stream: false,
        });

        const text = response.choices[0]?.message?.content;
        if (!text) {
          continue;
        }

        const parsed = parseActionDraftPayload(text);
        if (!parsed) {
          continue;
        }

        return {
          ...parsed,
          model,
          generatedBy: 'groq',
        };
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError ?? new Error('All configured Groq models failed to return an action draft.');
}

export async function extractWeeklyReviewData(emails: MockEmail[], options: WeeklyReviewOptions = {}): Promise<WeeklyReviewData> {
  const referenceNowMs = resolveReferenceNowMs(options.referenceNow);
  const config = getEffectiveReviewConfig(options.config);
  const groqApiKeys = getConfiguredGroqApiKeys();

  if (groqApiKeys.length > 0) {
    try {
      console.info(`Weekly review: trying GPT-first extraction across ${groqApiKeys.length} configured key(s), then secondary models.`);
      return await extractWeeklyReviewDataWithGroq(emails, groqApiKeys, referenceNowMs, config);
    } catch (error) {
      console.warn('Weekly review: all configured Groq keys and fallback models failed, using deterministic fallback.', error);
    }
  }

  if (groqApiKeys.length === 0) {
    console.info('Weekly review: no Groq API key detected, using deterministic fallback.');
  } else {
    console.warn('Weekly review: all configured Groq keys or models failed, using deterministic fallback.');
  }
  return buildDeterministicWeeklyReview(emails, referenceNowMs, config);
}

export async function generateActionDraft(
  email: MockEmail,
  action: Pick<ExtractedAction, 'summary' | 'urgency' | 'dueDate'>,
  mode: ActionDraftMode,
  options: ActionDraftOptions = {},
): Promise<GeneratedActionDraft> {
  const referenceNowMs = resolveReferenceNowMs(options.referenceNow);
  const config = getEffectiveReviewConfig(options.config);
  const fallbackDraft = buildFallbackActionDraft(email, action, mode, options.recipientHint);
  const groqApiKeys = getConfiguredGroqApiKeys();

  if (groqApiKeys.length > 0) {
    try {
      return await generateActionDraftWithGroq(
        email,
        action,
        mode,
        groqApiKeys,
        referenceNowMs,
        config,
        options.recipientHint,
      );
    } catch (error) {
      console.warn(`Weekly review: failed to generate ${mode} draft with GPT-first Groq routing.`, error);
    }
  }

  return fallbackDraft;
}
