import type { CompletedReviewRecord, PersistedActionStatus, ReviewActionArtifact } from './weeklyReviewStore';

const DB_NAME = 'weekly-review-activity-db';
const DB_VERSION = 1;
const ACTION_RECORDS_STORE = 'action-records';
const REVIEW_COMPLETIONS_STORE = 'review-completions';

export interface PersistedThreadActionRecord {
  artifact?: ReviewActionArtifact;
  latestExternalActivityTs: number;
  reviewContextKey: string;
  reviewPeriodKey: string;
  status: Extract<PersistedActionStatus, 'resolved' | 'dismissed' | 'carry-forward' | 'snoozed'>;
  summary: string;
  threadId: string;
  updatedAt: string;
}

type ReviewCompletionEntry = {
  id: string;
  record: CompletedReviewRecord;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(ACTION_RECORDS_STORE)) {
        db.createObjectStore(ACTION_RECORDS_STORE, { keyPath: 'threadId' });
      }

      if (!db.objectStoreNames.contains(REVIEW_COMPLETIONS_STORE)) {
        db.createObjectStore(REVIEW_COMPLETIONS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
  });

  return dbPromise;
}

function withStore<T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  return openDatabase().then((db) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    return run(store);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function isActionStatus(value: unknown): value is PersistedThreadActionRecord['status'] {
  return value === 'resolved' || value === 'dismissed' || value === 'carry-forward' || value === 'snoozed';
}

function normalizeActionRecord(value: unknown): PersistedThreadActionRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.threadId !== 'string' ||
    typeof record.summary !== 'string' ||
    typeof record.reviewPeriodKey !== 'string' ||
    typeof record.reviewContextKey !== 'string' ||
    typeof record.updatedAt !== 'string' ||
    !Number.isFinite(Number(record.latestExternalActivityTs)) ||
    !isActionStatus(record.status)
  ) {
    return null;
  }

  return {
    threadId: record.threadId,
    summary: record.summary,
    reviewPeriodKey: record.reviewPeriodKey,
    reviewContextKey: record.reviewContextKey,
    updatedAt: record.updatedAt,
    latestExternalActivityTs: Number(record.latestExternalActivityTs),
    status: record.status,
    artifact: typeof record.artifact === 'object' && record.artifact ? record.artifact as ReviewActionArtifact : undefined,
  };
}

function getCompletionEntryId(reviewPeriodKey: string, reviewContextKey: string): string {
  return `${reviewPeriodKey}::${reviewContextKey}`;
}

export async function loadPersistedThreadActionRecords(): Promise<PersistedThreadActionRecord[]> {
  try {
    return await withStore(ACTION_RECORDS_STORE, 'readonly', async (store) => {
      const result = await requestToPromise(store.getAll());
      return result
        .map(normalizeActionRecord)
        .filter((record): record is PersistedThreadActionRecord => Boolean(record));
    });
  } catch (error) {
    console.warn('Weekly review DB: failed to load action records.', error);
    return [];
  }
}

export async function savePersistedThreadActionRecords(records: PersistedThreadActionRecord[]): Promise<void> {
  try {
    await withStore(ACTION_RECORDS_STORE, 'readwrite', async (store) => {
      await Promise.all(records.map((record) => requestToPromise(store.put(record))));
    });
  } catch (error) {
    console.warn('Weekly review DB: failed to save action records.', error);
  }
}

export async function loadReviewCompletionRecord(
  reviewPeriodKey: string,
  reviewContextKey: string,
): Promise<CompletedReviewRecord | null> {
  try {
    return await withStore(REVIEW_COMPLETIONS_STORE, 'readonly', async (store) => {
      const entry = await requestToPromise(store.get(getCompletionEntryId(reviewPeriodKey, reviewContextKey)) as IDBRequest<ReviewCompletionEntry | undefined>);
      return entry?.record ?? null;
    });
  } catch (error) {
    console.warn('Weekly review DB: failed to load completion record.', error);
    return null;
  }
}

export async function saveReviewCompletionRecordToDb(record: CompletedReviewRecord): Promise<void> {
  try {
    await withStore(REVIEW_COMPLETIONS_STORE, 'readwrite', async (store) => {
      await requestToPromise(store.put({
        id: getCompletionEntryId(record.reviewPeriodKey, record.reviewContextKey),
        record,
      } satisfies ReviewCompletionEntry));
    });
  } catch (error) {
    console.warn('Weekly review DB: failed to save completion record.', error);
  }
}

export async function loadLatestReviewCompletionRecordForPeriod(reviewPeriodKey: string): Promise<CompletedReviewRecord | null> {
  try {
    return await withStore(REVIEW_COMPLETIONS_STORE, 'readonly', async (store) => {
      const entries = await requestToPromise(store.getAll() as IDBRequest<ReviewCompletionEntry[]>);
      const matches = entries
        .map((entry) => entry.record)
        .filter((record) => record.reviewPeriodKey === reviewPeriodKey)
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt));

      return matches[0] ?? null;
    });
  } catch (error) {
    console.warn('Weekly review DB: failed to load latest completion record for period.', error);
    return null;
  }
}
