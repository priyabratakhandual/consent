/**
 * Parse PostgreSQL URL and return components. Used to build tenant DB URL and server URL for CREATE DATABASE.
 * @param {string} url - e.g. postgresql://user:pass@host:5432/dbname
 * @returns {{ host, port, user, password, database }}
 */
export function parsePostgresUrl(url) {
  if (url == null || typeof url !== 'string') {
    throw new Error('Invalid PostgreSQL URL: URL is required');
  }
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('Invalid PostgreSQL URL: MASTER_DATABASE_URL is empty');
  }
  if (!/^postgres(ql)?:\/\//i.test(trimmed)) {
    throw new Error('Invalid PostgreSQL URL: must start with postgresql:// or postgres://');
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'postgresql:' && u.protocol !== 'postgres:') {
      throw new Error('URL must be postgresql:// or postgres://');
    }
    const database = u.pathname ? u.pathname.slice(1).replace(/%2F/g, '/') : null;
    return {
      host: u.hostname,
      port: u.port ? parseInt(u.port, 10) : 5432,
      user: decodeURIComponent(u.username),
      password: u.password ? decodeURIComponent(u.password) : '',
      database,
    };
  } catch (e) {
    throw new Error(`Invalid PostgreSQL URL: ${e.message}`);
  }
}

/**
 * Build PostgreSQL URL from components.
 * @param {{ host, port, user, password, database? }}
 */
export function buildPostgresUrl({ host, port, user, password, database }) {
  const auth = password
    ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
    : encodeURIComponent(user);
  const portPart = port && port !== 5432 ? `:${port}` : '';
  const path = database ? `/${encodeURIComponent(database)}` : '';
  return `postgresql://${auth}@${host}${portPart}${path}`;
}

export default parsePostgresUrl;
