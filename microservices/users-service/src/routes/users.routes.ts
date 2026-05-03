import { Router } from 'express';
import { z } from 'zod';
import { canListUserDirectory, canViewUserProfile } from '../policy/authorization.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { BootstrapService } from '../services/bootstrap.service.js';
import { UsersService } from '../services/users.service.js';

const bootstrapBody = z.object({
  schoolId: z.string().uuid(),
  userName: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
});

export function usersRouter(svc = new UsersService(), bootstrap = new BootstrapService()) {
  const r = Router();

  r.use(requireAuth);

  r.get('/me', async (req, res) => {
    try {
      const auth = req.auth!;
      const user = await svc.getUserInSchool(auth.userId, auth.schoolId);
      if (!user) {
        res.status(404).json({ error: 'user_not_found' });
        return;
      }
      res.json({ user });
    } catch (e) {
      console.error(e);
      res.status(503).json({ error: 'service_unavailable' });
    }
  });

  r.post('/bootstrap-school-admin', async (req, res) => {
    try {
      if (req.auth!.role !== 'platform_master') {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      const parsed = bootstrapBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
        return;
      }
      const result = await bootstrap.createSchoolAdminUser(parsed.data);
      if (!result.ok) {
        if (result.reason === 'school_not_found') {
          res.status(404).json({ error: 'school_not_found' });
          return;
        }
        if (result.reason === 'duplicate_email') {
          res.status(409).json({ error: 'duplicate_email' });
          return;
        }
        res.status(503).json({ error: 'bootstrap_failed' });
        return;
      }
      res.status(201).json({
        user: result.user,
        temporaryPassword: result.temporaryPassword,
      });
    } catch (e) {
      console.error(e);
      res.status(503).json({ error: 'service_unavailable' });
    }
  });

  r.get('/', async (req, res) => {
    try {
      const auth = req.auth!;
      if (!canListUserDirectory(auth.role)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      const users = await svc.listUsersBySchool(auth.schoolId);
      res.json({ users });
    } catch (e) {
      console.error(e);
      res.status(503).json({ error: 'service_unavailable' });
    }
  });

  r.get('/:userId', async (req, res) => {
    try {
      const auth = req.auth!;
      const { userId } = req.params;
      if (!userId) {
        res.status(400).json({ error: 'missing_user_id' });
        return;
      }
      const user = await svc.getUserInSchool(userId, auth.schoolId);
      if (!user) {
        res.status(404).json({ error: 'user_not_found' });
        return;
      }
      if (!canViewUserProfile(auth.role, auth.userId, userId)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      res.json({ user });
    } catch (e) {
      console.error(e);
      res.status(503).json({ error: 'service_unavailable' });
    }
  });

  return r;
}
