import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Resuelve el secreto de firma JWT.
 * - Si JWT_SECRET está definido, se usa siempre.
 * - En producción sin JWT_SECRET se genera un secreto aleatorio efímero (nunca una clave conocida):
 *   los tokens dejan de ser válidos al reiniciar el proceso, por lo que debe configurarse la variable.
 * - En desarrollo/test se usa una clave local fija para no invalidar sesiones en cada recarga de tsx watch.
 */
function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    console.error('[Security] JWT_SECRET no está definido en producción. Se generó un secreto aleatorio efímero: ' +
      'las sesiones se invalidarán en cada reinicio. Configure JWT_SECRET en las variables de entorno del servidor.');
    return crypto.randomBytes(48).toString('hex');
  }

  return 'basetrack_local_dev_only_secret';
}

const JWT_SECRET = resolveJwtSecret();
const JWT_EXPIRES_IN = '24h';

export interface TokenPayload {
  userId: string;
  username: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'OPERADOR';
  shift: string;
  fullName: string;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
