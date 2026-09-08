import type { ApiEnvironment } from '../app';

export interface HealthView {
  status: 'ok' | 'degraded';
  service: 'pointapp-builder';
  environment: string;
  version: string;
  checks: {
    database: 'ok' | 'unavailable';
    authentication: 'ok' | 'unavailable';
    publishing: 'ok' | 'unavailable';
  };
  time: string;
}

export async function readHealth(environment: ApiEnvironment): Promise<HealthView> {
  let database: HealthView['checks']['database'] = 'unavailable';
  try {
    const result = await environment.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
    if (result?.ok === 1) database = 'ok';
  } catch {
    // Safe health output records only availability, never the underlying database error.
  }
  const authentication = environment.AUTHENTICATION_ENABLED === 'true' ? 'ok' : 'unavailable';
  const publishing = environment.PUBLISHING_ENABLED === 'true' ? 'ok' : 'unavailable';
  const status = [database, authentication, publishing].every((check) => check === 'ok')
    ? 'ok'
    : 'degraded';
  return {
    status,
    service: 'pointapp-builder',
    environment: environment.ENVIRONMENT,
    version: environment.APP_VERSION,
    checks: { database, authentication, publishing },
    time: new Date().toISOString(),
  };
}
