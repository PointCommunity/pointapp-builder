import { ProblemError } from './problems';

export async function runStatement(statement: D1PreparedStatement): Promise<D1Result> {
  const result = await statement.run();
  if (!result.success)
    throw new ProblemError(500, 'DATABASE_WRITE_FAILED', 'The change could not be saved');
  return result;
}

export async function requireRow<T>(
  statement: D1PreparedStatement,
  code = 'NOT_FOUND',
  message = 'The requested record does not exist',
): Promise<T> {
  const row = await statement.first<T>();
  if (!row) throw new ProblemError(404, code, message);
  return row;
}

export async function listRows<T>(statement: D1PreparedStatement): Promise<T[]> {
  const result = await statement.all<T>();
  if (!result.success)
    throw new ProblemError(500, 'DATABASE_READ_FAILED', 'The records could not be loaded');
  return result.results;
}

export function parseStoredJson<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new ProblemError(500, 'STORED_DATA_INVALID', 'Stored data could not be read');
  }
}
