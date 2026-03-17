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

export async function extractWeeklyReviewData(emails: MockEmail[]): Promise<WeeklyReviewData> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
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
    throw new Error("No response from Gemini");
  }

  return JSON.parse(text) as WeeklyReviewData;
}
