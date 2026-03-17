import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { MockEmail } from "./mockData";

export interface ExtractedTheme {
  title: string;
  summary: string;
  threadIds: string[];
  hasCriticalAction: boolean;
}

export interface ExtractedAction {
  threadId: string;
  summary: string;
  urgency: "Critical" | "High" | "Medium" | "Low";
  dueDate?: string;
  confidence: number;
  status?: "Pending" | "Resolved" | "CarryForward" | "Snoozed" | "Dismissed";
}

export interface WeeklyReviewData {
  themes: ExtractedTheme[];
  actions: ExtractedAction[];
}

const FREE_SUMMARIZER_MODEL = "https://api-inference.huggingface.co/models/sshleifer/distilbart-cnn-12-6";

function fallbackSummary(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "No summary available.";
  return clean.length > 140 ? `${clean.substring(0, 140)}...` : clean;
}

async function summarizeWithFreeModel(text: string): Promise<string> {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "No summary available.";

  try {
    const response = await fetch(FREE_SUMMARIZER_MODEL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: clean.substring(0, 1200),
        parameters: { max_length: 72, min_length: 20 }
      })
    });

    if (!response.ok) {
      return fallbackSummary(clean);
    }

    const data = await response.json();
    if (Array.isArray(data) && typeof data[0]?.summary_text === "string") {
      return data[0].summary_text;
    }

    return fallbackSummary(clean);
  } catch (error) {
    console.warn("Free summarizer request failed:", error);
    return fallbackSummary(clean);
  }
}

function detectUrgency(email: MockEmail): ExtractedAction["urgency"] {
  const text = `${email.subject} ${email.snippet}`.toLowerCase();
  if (/(urgent|asap|overdue|today|immediately|final reminder|deadline)/.test(text)) return "Critical";
  if (/(due|tomorrow|action required|payment|submit|review)/.test(text)) return "High";
  if (/(update|please|request|confirm|follow up)/.test(text)) return "Medium";
  return "Low";
}

async function buildFreeModelWeeklyReview(emails: MockEmail[]): Promise<WeeklyReviewData> {
  const buckets: Array<{ title: string; match: (email: MockEmail) => boolean }> = [
    { title: "Finance & Payments", match: (e) => /bank|payment|invoice|trade|demat|zerodha|nse/i.test(`${e.sender} ${e.subject}`) },
    { title: "Academics & Deadlines", match: (e) => /assignment|class|spjimr|course|quiz|attendance|submission/i.test(`${e.sender} ${e.subject}`) },
    { title: "Promotions & Marketing", match: (e) => e.category === "promotions" || /offer|sale|discount|ajio|swiggy/i.test(`${e.sender} ${e.subject}`) }
  ];

  const groups = new Map<string, MockEmail[]>();
  for (const email of emails) {
    const bucket = buckets.find((b) => b.match(email));
    const key = bucket?.title ?? "General Updates";
    const list = groups.get(key) ?? [];
    list.push(email);
    groups.set(key, list);
  }

  const themes: ExtractedTheme[] = [];
  const actions: ExtractedAction[] = [];

  for (const [title, groupEmails] of groups.entries()) {
    const combined = groupEmails
      .slice(0, 4)
      .map((email) => `${email.sender}: ${email.subject}. ${email.snippet}`)
      .join(" ");

    const summary = await summarizeWithFreeModel(combined);
    const hasCriticalAction = groupEmails.some((email) => detectUrgency(email) === "Critical");

    themes.push({
      title,
      summary,
      threadIds: groupEmails.map((email) => email.id),
      hasCriticalAction
    });

    groupEmails.slice(0, 3).forEach((email) => {
      const urgency = detectUrgency(email);
      actions.push({
        threadId: email.id,
        summary: `Review: ${email.subject}`,
        urgency,
        confidence: urgency === "Critical" ? 88 : urgency === "High" ? 80 : 72,
        status: "Pending"
      });
    });
  }

  return { themes, actions };
}

export async function extractWeeklyReviewData(emails: MockEmail[]): Promise<WeeklyReviewData> {
  const apiKey =
    (typeof process !== "undefined" ? (process as any).env?.GEMINI_API_KEY : undefined) ||
    localStorage.getItem("gemini_api_key") ||
    undefined;
  if (!apiKey) {
    return buildFreeModelWeeklyReview(emails);
  }

  const ai = new GoogleGenAI({ apiKey });

  const simplifiedEmails = emails.map(e => ({
    id: e.id,
    subject: e.subject,
    sender: e.sender,
    date: e.date,
    bodySnippet: e.snippet,
    // Only include the first 500 characters of the body to save tokens
    body: e.messages[0]?.body ? e.messages[0].body.substring(0, 500) + (e.messages[0].body.length > 500 ? '...' : '') : ''
  }));

  const prompt = `
    You are an intelligent email assistant. Analyze the following emails and extract:
    1. Key themes (clusters of related emails).
    2. Action items (tasks the user needs to do).

    Emails:
    ${JSON.stringify(simplifiedEmails, null, 2)}

    For themes:
    - Group related emails into themes.
    - Provide a title and a short summary for each theme.
    - List the threadIds associated with the theme.
    - Indicate if any of the actions in this theme are critical.

    For action items:
    - Extract explicit or implicit tasks for the user.
    - Assign an urgency level: Critical, High, Medium, Low.
      - Critical: deadline <= 24h OR escalation signal present.
      - High: deadline <= 3 days OR sender priority high + unresolved ask.
      - Medium: no hard deadline but actionable request exists.
      - Low: informational follow-up, optional task.
    - Provide a short summary of the action.
    - Include the threadId.
    - Include a due date if mentioned (ISO format).
    - Provide a confidence score (0-100).
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          themes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                threadIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                hasCriticalAction: { type: Type.BOOLEAN }
              },
              required: ["title", "summary", "threadIds", "hasCriticalAction"]
            }
          },
          actions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                threadId: { type: Type.STRING },
                summary: { type: Type.STRING },
                urgency: { type: Type.STRING, enum: ["Critical", "High", "Medium", "Low"] },
                dueDate: { type: Type.STRING },
                confidence: { type: Type.NUMBER }
              },
              required: ["threadId", "summary", "urgency", "confidence"]
            }
          }
        },
        required: ["themes", "actions"]
      }
    }
  });

  const text = response.text;
  if (!text) {
    return buildFreeModelWeeklyReview(emails);
  }

  try {
    return JSON.parse(text) as WeeklyReviewData;
  } catch (error) {
    console.error("Failed to parse Gemini response, using free fallback:", error);
    return buildFreeModelWeeklyReview(emails);
  }
}
