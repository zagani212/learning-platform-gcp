import { createServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config, corsOrigins } from './config.js';
import { pool } from './db/pool.js';
import { schoolsRouter } from './routes/schools.routes.js';

const app = express();

app.use(helmet());
app.use(express.json({ limit: '32kb' }));
app.use(
  cors({
    origin: corsOrigins(),
    credentials: true,
  }),
);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'schools-service' });
});

app.get('/health/db', async (_req, res) => {
  try {
    await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, database: 'reachable' });
  } catch (e) {
    console.error(e);
    res.status(503).json({ ok: false, database: 'unreachable' });
  }
});

app.use('/v1/schools', schoolsRouter());

app.use((_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

const server = createServer(app);

server.listen(config.PORT, () => {
  console.log(`schools-service listening on :${config.PORT} (${config.NODE_ENV})`);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}, closing…`);
  try {
    server.close(() => console.log('HTTP server closed'));
    await pool.end();
  } finally {
    process.exit(0);
  }
}

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    void shutdown(sig);
  });
}
