import crypto from 'crypto';
import { type Request, type Response, type NextFunction } from 'express';
import { getDb } from './db.js';

const SESSION_SECRET = process.env.SESSION_SECRET || 'xorvilabox-super-secret-key-production-998811';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, combinedHash: string): boolean {
  try {
    const [salt, storedHash] = combinedHash.split(':');
    if (!salt || !storedHash) return false;
    const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(computedHash, 'hex'));
  } catch {
    return false;
  }
}

export function generateToken(payload: { id: string; username: string; role: string }): string {
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifyToken(token: string): { id: string; username: string; role: string } | null {
  try {
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function ensureDefaultAdmin(): Promise<void> {
  const db = getDb();
  const existing = await db.execute(`SELECT id FROM users LIMIT 1;`);
  if (existing.rows.length === 0) {
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
    const id = crypto.randomUUID();
    const hash = hashPassword(defaultPassword);
    const now = new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)`,
      args: [id, 'admin', hash, 'admin', now],
    });
    console.log('[XorvilaBox Auth] Default administrator initialized: admin /', defaultPassword);
  }
}

export interface AuthenticatedRequest extends Request {
  user?: { id: string; username: string; role: string };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Check cookie or Authorization header
  const token = req.cookies?.xorvila_session || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  req.user = payload;
  next();
}
