import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface AuthContext {
  userId: string;
  schoolId: string;
  role: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

/**
 * Validates Bearer JWT from auth-service (claims: uid, sid, role — plus subject).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const hdr = req.headers.authorization;
  if (!hdr?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing_bearer_token' });
    return;
  }
  const token = hdr.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'missing_bearer_token' });
    return;
  }
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload & {
      uid?: string;
      sid?: string;
      role?: string;
      typ?: string;
    };
    const userId = typeof payload.uid === 'string' ? payload.uid : payload.sub;
    const schoolId = typeof payload.sid === 'string' ? payload.sid : undefined;
    const role = typeof payload.role === 'string' ? payload.role : undefined;
    if (!userId || !schoolId || !role) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }
    req.auth = { userId, schoolId, role };
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}
