import { Router } from 'express';
import { canListUserDirectory, canViewUserProfile } from '../policy/authorization.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { UsersService } from '../services/users.service.js';

export function usersRouter(svc = new UsersService()) {
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
