import * as SQLite from 'expo-sqlite';

import type { QueueItem } from '@/types/models';

const db = SQLite.openDatabase('store_worker.db');

function execSql(sql: string, params: Array<string | number | null> = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        sql,
        params,
        () => resolve(),
        (_transaction, error) => {
          reject(error);
          return false;
        },
      );
    });
  });
}

export async function ensureQueueTable(): Promise<void> {
  await execSql(`
    CREATE TABLE IF NOT EXISTS offline_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      createdAt TEXT NOT NULL,
      lastAttemptAt TEXT,
      retryCount INTEGER NOT NULL DEFAULT 0,
      errorMessage TEXT
    );
  `);
}

export async function enqueueItem(item: Omit<QueueItem, 'id'>): Promise<void> {
  await execSql(
    'INSERT INTO offline_queue (type, payload, status, createdAt, lastAttemptAt, retryCount, errorMessage) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [item.type, item.payload, item.status, item.createdAt, item.lastAttemptAt ?? null, item.retryCount, item.errorMessage ?? null],
  );
}

export async function listQueueItems(): Promise<QueueItem[]> {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'SELECT * FROM offline_queue ORDER BY createdAt ASC',
        [],
        (_transaction, result) => {
          resolve(result.rows._array as QueueItem[]);
        },
        (_transaction, error) => {
          reject(error);
          return false;
        },
      );
    });
  });
}
