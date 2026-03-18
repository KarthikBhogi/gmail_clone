import { MockEmail } from './mockData';

type PersistedEmailStateV1 = {
  version: 1;
  statuses: Record<string, { unread: boolean; starred: boolean }>;
  updatedAt: string;
};

const EMAIL_STATE_KEY = 'gmail_clone_email_state_v1';

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

export const loadEmailState = (seedEmails: MockEmail[]): MockEmail[] => {
  try {
    const raw = localStorage.getItem(EMAIL_STATE_KEY);
    if (!raw) {
      return seedEmails;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedEmailStateV1>;
    if (parsed.version !== 1 || !parsed.statuses || typeof parsed.statuses !== 'object') {
      return seedEmails;
    }

    return seedEmails.map((email) => {
      const state = parsed.statuses?.[email.id];
      if (!state || !isBoolean(state.unread) || !isBoolean(state.starred)) {
        return email;
      }

      return {
        ...email,
        unread: state.unread,
        starred: state.starred,
      };
    });
  } catch {
    return seedEmails;
  }
};

export const saveEmailState = (emails: MockEmail[]): void => {
  const payload: PersistedEmailStateV1 = {
    version: 1,
    statuses: Object.fromEntries(
      emails.map((email) => [email.id, { unread: email.unread, starred: Boolean(email.starred) }])
    ),
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(EMAIL_STATE_KEY, JSON.stringify(payload));
};

export const clearEmailState = (): void => {
  localStorage.removeItem(EMAIL_STATE_KEY);
};
