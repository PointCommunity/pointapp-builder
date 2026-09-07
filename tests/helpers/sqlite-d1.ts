import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type BoundValue = ArrayBuffer | ArrayBufferView | null | number | string;

function normalizeValue(value: BoundValue): null | number | string | Uint8Array {
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return value;
}

class SQLiteD1Statement implements D1PreparedStatement {
  readonly #database: DatabaseSync;
  readonly #query: string;
  readonly #values: BoundValue[];

  constructor(database: DatabaseSync, query: string, values: BoundValue[] = []) {
    this.#database = database;
    this.#query = query;
    this.#values = values;
  }

  bind(...values: BoundValue[]): D1PreparedStatement {
    return new SQLiteD1Statement(this.#database, this.#query, values);
  }

  async first<T = unknown>(column?: string): Promise<T | null> {
    const row = this.#database.prepare(this.#query).get(...this.#values.map(normalizeValue)) as
      Record<string, unknown> | undefined;
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const result = this.#database.prepare(this.#query).run(...this.#values.map(normalizeValue));
    return {
      success: true,
      results: [],
      meta: {
        changed_db: true,
        changes: Number(result.changes),
        duration: 0,
        last_row_id: Number(result.lastInsertRowid),
        rows_read: 0,
        rows_written: Number(result.changes),
        size_after: 0,
      },
    } as D1Result<T>;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const results = this.#database
      .prepare(this.#query)
      .all(...this.#values.map(normalizeValue)) as T[];
    return { success: true, results, meta: {} } as D1Result<T>;
  }

  raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>;
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
  async raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[] | [string[], ...T[]]> {
    const rows = this.#database
      .prepare(this.#query)
      .all(...this.#values.map(normalizeValue)) as Record<string, unknown>[];
    const keys = rows[0] ? Object.keys(rows[0]) : [];
    const values = rows.map((row) => keys.map((key) => row[key]));
    return (options?.columnNames ? [keys, ...values] : values) as T[] | [string[], ...T[]];
  }
}

export class SQLiteD1Database implements D1Database {
  readonly database = new DatabaseSync(':memory:');

  constructor() {
    this.database.exec('PRAGMA foreign_keys = ON');
  }

  prepare(query: string): D1PreparedStatement {
    return new SQLiteD1Statement(this.database, query);
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const results: D1Result<T>[] = [];
      for (const statement of statements) results.push(await statement.run<T>());
      this.database.exec('COMMIT');
      return results;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  async exec(query: string): Promise<D1ExecResult> {
    this.database.exec(query);
    return { count: 1, duration: 0 };
  }

  withSession(): D1DatabaseSession {
    throw new Error('withSession is not implemented by the deterministic test adapter');
  }

  dump(): Promise<ArrayBuffer> {
    throw new Error('dump is not implemented by the deterministic test adapter');
  }

  applyMigrations() {
    for (const file of readdirSync(resolve('migrations'))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort()) {
      this.database.exec(readFileSync(resolve('migrations', file), 'utf8'));
    }
  }
}
