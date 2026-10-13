import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Resuelve el secreto de firma JWT.
 * - Si JWT_SECRET está definido, se usa siempre.
 * - Solo con NODE_ENV=development o test explícito se usa una clave local fija, para no invalidar
 *   sesiones en cada recarga de tsx watch.
 * - En cualquier otro caso (producción, o NODE_ENV sin definir en un servidor) se genera un secreto
 *   aleatorio efímero: nunca una clave conocida que permita falsificar tokens. Las sesiones se
 *   invalidan al reiniciar, por lo que debe configurarse JWT_SECRET.
 */
function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) return fromEnv;

  const env = process.env.NODE_ENV;
  if (env === 'development' || env === 'test') {
    return 'basetrack_local_dev_only_secret';
  }

  console.error(`[Security] JWT_SECRET no está definido (NODE_ENV=${env ?? 'sin definir'}). Se generó un secreto ` +
    'aleatorio efímero: las sesiones se invalidarán en cada reinicio. Configure JWT_SECRET en el servidor.');
  return crypto.randomBytes(48).toString('hex');
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
