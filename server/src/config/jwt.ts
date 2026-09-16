import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'basetrack_industrial_secret_key_2026_super_secure_token';
const JWT_EXPIRES_IN = '24h';

export interface TokenPayload {
  userId: string;
  username: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'OPERATOR';
  shift: string;
  fullName: string;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
