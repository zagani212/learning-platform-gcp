import pg from 'pg';
import { config } from '../config.js';

function buildPoolConfig(): pg.PoolConfig {
  const database = config.DATABASE_NAME;
  const user = config.DATABASE_USER;
  const password = config.DATABASE_PASSWORD;
  const max = config.DATABASE_POOL_MAX;

  if (config.DATABASE_SOCKET.trim()) {
    return {
      user,
      password,
      database,
      host: config.DATABASE_SOCKET.trim(),
      max,
      ssl:
        config.DATABASE_SSL ? { rejectUnauthorized: true }
        : undefined,
    };
  }

  if (config.DATABASE_INSTANCE_CONNECTION.trim()) {
    const sock = `/cloudsql/${config.DATABASE_INSTANCE_CONNECTION.trim()}`;
    return {
      user,
      password,
      database,
      host: sock,
      max,
      ssl:
        config.DATABASE_SSL ? { rejectUnauthorized: true }
        : undefined,
    };
  }

  return {
    user,
    password,
    database,
    host: config.DATABASE_HOST,
    port: config.DATABASE_PORT,
    max,
    ssl:
      config.DATABASE_SSL ? { rejectUnauthorized: false }
      : undefined,
  };
}

export const pool = new pg.Pool(buildPoolConfig());

pool.on('error', (err) => {
  console.error('PostgreSQL pool error', err);
});
