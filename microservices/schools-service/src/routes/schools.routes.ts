import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { SchoolsService } from '../services/schools.service.js';

export function schoolsRouter(svc = new SchoolsService()) {
  const r = Router();

  r.use(requireAuth);

  r.get('/', async (req, res) => {
    try {
      if (req.auth!.role !== 'school_admin') {
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
      if (schoolId !== req.auth!.schoolId) {
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
