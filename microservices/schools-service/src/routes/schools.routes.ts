import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { SchoolsService } from '../services/schools.service.js';

const createTenantBody = z.object({
  name: z.string().trim().min(1).max(300),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  initialAdmin: z.object({
    userName: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(320),
  }),
});

type BootstrapResponse = {
  user: {
    userId: string;
    schoolId: string;
    userName: string;
    email: string;
    role: string;
    active: boolean;
    createdAt: string;
  };
  temporaryPassword: string;
};

export function schoolsRouter(svc = new SchoolsService()) {
  const r = Router();

  r.use(requireAuth);

  r.post('/', async (req, res) => {
    try {
      if (req.auth!.role !== 'platform_master') {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const parsed = createTenantBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
        return;
      }

      const { name, slug, initialAdmin } = parsed.data;

      let school;
      try {
        school = await svc.createSchool(name, slug);
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err?.code === '23505') {
          res.status(409).json({ error: 'duplicate_slug' });
          return;
        }
        console.error(e);
        res.status(503).json({ error: 'service_unavailable' });
        return;
      }

      const base = config.USERS_SERVICE_INTERNAL_URL.replace(/\/$/, '');
      const fwd = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';

      try {
        const br = await fetch(`${base}/v1/users/bootstrap-school-admin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(fwd ? { Authorization: fwd } : {}),
          },
          body: JSON.stringify({
            schoolId: school.schoolId,
            userName: initialAdmin.userName,
            email: initialAdmin.email,
          }),
        });

        const data = (await br.json().catch(() => ({}))) as Partial<BootstrapResponse> & {
          error?: string;
        };

        if (!br.ok) {
          await svc.deleteSchool(school.schoolId).catch(() => {});
          res.status(br.status >= 400 && br.status < 600 ? br.status : 502).json({
            error: 'tenant_bootstrap_failed',
            upstream: data.error ?? 'unknown',
            detail: data,
          });
          return;
        }

        if (!data.user || typeof data.temporaryPassword !== 'string') {
          await svc.deleteSchool(school.schoolId).catch(() => {});
          res.status(502).json({ error: 'malformed_bootstrap_response' });
          return;
        }

        res.status(201).json({
          school,
          schoolAdmin: {
            userId: data.user.userId,
            email: data.user.email,
            userName: data.user.userName,
            temporaryPassword: data.temporaryPassword,
          },
        });
      } catch (e) {
        console.error(e);
        await svc.deleteSchool(school.schoolId).catch(() => {});
        res.status(502).json({ error: 'users_service_unreachable' });
      }
    } catch (e) {
      console.error(e);
      res.status(503).json({ error: 'service_unavailable' });
    }
  });

  r.get('/', async (req, res) => {
    try {
      const role = req.auth!.role;
      if (role !== 'school_admin' && role !== 'platform_master') {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      const schools = await svc.listSchools();
      res.json({ schools });
    } catch (e) {
      console.error(e);
      res.status(503).json({ error: 'service_unavailable' });
    }
  });

  r.get('/me', async (req, res) => {
    try {
      const schoolId = req.auth!.schoolId;
      const school = await svc.getSchoolById(schoolId);
      if (!school) {
        res.status(404).json({ error: 'school_not_found' });
        return;
      }
      res.json({ school });
    } catch (e) {
      console.error(e);
      res.status(503).json({ error: 'service_unavailable' });
    }
  });

  r.get('/:schoolId', async (req, res) => {
    try {
      const { schoolId } = req.params;
      if (!schoolId) {
        res.status(400).json({ error: 'missing_school_id' });
        return;
      }
      if (schoolId !== req.auth!.schoolId && req.auth!.role !== 'platform_master') {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      const school = await svc.getSchoolById(schoolId);
      if (!school) {
        res.status(404).json({ error: 'school_not_found' });
        return;
      }
      res.json({ school });
    } catch (e) {
      console.error(e);
      res.status(503).json({ error: 'service_unavailable' });
    }
  });

  return r;
}
