import { Router } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service.js';

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(1024),
});

export function authRouter(authService = new AuthService()) {
  const r = Router();

  r.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'invalid_request',
        details: parsed.error.flatten(),
      });
      return;
    }

    try {
      const result = await authService.verifyEmailPassword(
        parsed.data.email,
        parsed.data.password,
      );

      if (!result.ok) {
        const status = result.reason === 'account_disabled' ? 403 : 401;
        res.status(status).json({ error: result.reason });
        return;
      }

      res.json({
        accessToken: result.accessToken,
        tokenType: result.tokenType,
        expiresIn: result.expiresInSeconds,
        user: result.user,
      });
    } catch (e) {
      console.error(e);
      res.status(503).json({ error: 'auth_unavailable' });
    }
  });

  return r;
}
