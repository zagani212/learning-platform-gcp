import { createServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config, corsOrigins } from './config.js';
import { mediaRouter } from './routes/media.routes.js';

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
  res.json({ ok: true, service: 'media-service' });
});

app.use('/v1/media', mediaRouter());

app.use((_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

const server = createServer(app);

server.listen(config.PORT, () => {
  console.log(`media-service listening on :${config.PORT} (${config.NODE_ENV})`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}, closing…`);
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
}

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => shutdown(sig));
}
