import crypto from 'node:crypto';

// Sin caracteres ambiguos (0/O, 1/l/I) para dictarla o copiarla a mano en planta
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** Contraseña temporal aleatoria, p. ej. "Kp7m-Rt4x-9qWz". Se entrega una sola vez al administrador. */
export function generateTemporaryPassword(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
  return `${group()}-${group()}-${group()}`;
}

/** Contraseñas que nunca deben aceptarse como definitivas (publicadas en el repositorio o plantillas). */
export const PUBLIC_DEFAULT_PASSWORDS = new Set(['Basetrack2026!', 'Password123!', '91209966', 'mantenimiento123']);
