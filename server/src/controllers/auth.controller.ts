import { Request, Response } from 'express';
import { PUBLIC_DEFAULT_PASSWORDS } from '../utils/temp-password.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db } from '../database/db.js';
import { generateToken } from '../config/jwt.js';
import { AuthenticatedRequest, bumpTokenVersion } from '../middlewares/auth.middleware.js';
import { disconnectWsClients } from '../websocket/ws.js';
import { logAudit } from '../middlewares/error.middleware.js';

export async function login(req: Request, res: Response) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos' });
  }

  const cleanUser = String(username || '').trim();
  const cleanPass = String(password || '').trim();

  // Admin lookup strictly by username: 'admin' or 'marckv'
  let user: any = null;
  const isTargetingAdmin = ['admin', 'marckv', 'marck', 'marck vizcarra', 'marckvizcarra@basetrack.com'].includes(cleanUser.toLowerCase());

  if (isTargetingAdmin) {
    user = db.prepare('SELECT * FROM users WHERE LOWER(username) = ?').get('marckv') as any;
    if (!user) {
      user = db.prepare("SELECT * FROM users WHERE role = 'ADMIN'").get() as any;
    }
  } else {
    // Normal users / operators lookup (strictly not admin by DNI)
    user = db.prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) OR (document_id = ? AND role != 'ADMIN' AND document_id != '') OR (LOWER(full_name) = LOWER(?) AND role != 'ADMIN')").get(cleanUser, cleanUser, cleanUser, cleanUser) as any;
    if (!user) {
      // Allow login with operator DNI for operational staff
      const crew = db.prepare("SELECT name FROM crew_members WHERE document_id = ? AND document_id != ''").get(cleanUser) as { name: string } | undefined;
      if (crew) {
        user = db.prepare("SELECT * FROM users WHERE LOWER(full_name) = LOWER(?) AND role != 'ADMIN'").get(crew.name) as any;
      }
    }
    if (!user) {
      // Allow login with first name, alias or partial name (e.g. 'klisman', 'klismanvizcarra' -> KLISMANV).
      // Solo si la coincidencia es única: un alias ambiguo nunca debe elegir una cuenta arbitraria.
      const cleanLower = cleanUser.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanLower.length >= 3) {
        const candidates = db.prepare("SELECT * FROM users WHERE role != 'ADMIN'").all() as any[];
        const matches = candidates.filter(c => {
          const uLower = (c.username || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const fnLower = (c.full_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!uLower) return false;
          return uLower === cleanLower ||
                 uLower.startsWith(cleanLower) ||
                 cleanLower.startsWith(uLower) ||
                 fnLower.includes(cleanLower);
        });
        user = matches.length === 1 ? matches[0] : null;
      }
    }
  }

  if (!user) {
    return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
  }

  // Security check: Verify that user account has not been suspended
  if (user.is_active === 0 || user.is_active === false) {
    return res.status(403).json({ success: false, message: 'La cuenta ha sido suspendida. Contacte al Administrador.' });
  }

  let match = false;
  try {
    match = bcrypt.compareSync(cleanPass, user.password_hash);
  } catch {
    match = false;
  }

  if (!match) {
    return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
  }

  const token = generateToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    shift: user.shift,
    fullName: user.full_name,
    tokenVersion: user.token_version ?? 0
  });

  // Un nuevo inicio de sesión válido rehabilita la terminal si el Administrador la había revocado
  const loginDeviceId = req.headers['x-device-id']?.toString().slice(0, 100);
  if (loginDeviceId) {
    db.prepare('UPDATE connected_devices SET is_revoked = 0 WHERE device_id = ? AND is_revoked = 1').run(loginDeviceId);
  }

  logAudit(user.id, user.username, 'LOGIN', 'USERS', user.id, 'Inicio de sesión exitoso', req.ip || '127.0.0.1');

  return res.json({
    success: true,
    message: 'Inicio de sesión exitoso',
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      shift: user.shift,
      avatarUrl: user.avatar_url,
      document_id: user.role === 'ADMIN' ? '' : (user.document_id || ''),
      radio_channel: user.radio_channel,
      phone_extension: user.phone_extension,
      primary_role: user.primary_role,
      mustChangePassword: user.must_change_password === 1
    }
  });
}

export async function register(req: Request, res: Response) {
  return res.status(403).json({
    success: false,
    message: 'El registro manual de usuarios está estrictamente deshabilitado (PROHIBIDO). Ingrese con sus credenciales oficiales asignadas.'
  });
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }

  try {
    const user = db.prepare('SELECT id, username, email, full_name, role, shift, avatar_url, document_id, radio_channel, phone_extension, primary_role, created_at, must_change_password FROM users WHERE id = ?').get(req.user.userId) as any;

    if (!user) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado o sesión no válida' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        shift: user.shift,
        avatarUrl: user.avatar_url,
        document_id: user.document_id,
        radio_channel: user.radio_channel,
        phone_extension: user.phone_extension,
        primary_role: user.primary_role,
        createdAt: user.created_at,
        mustChangePassword: user.must_change_password === 1
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateProfile(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }

  try {
    const { fullName, email, avatarUrl, shift, document_id, radio_channel, phone_extension, primary_role } = req.body;
    const userId = req.user.userId;
    const username = req.user.username;

    // Check if user exists by ID or username
    const user = db.prepare('SELECT * FROM users WHERE id = ? OR username = ?').get(userId, username) as any;

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en la base de datos' });
    }

    const updatedFullName = fullName !== undefined ? fullName : user.full_name;
    const updatedEmail = email !== undefined ? email : user.email;
    const updatedAvatar = avatarUrl !== undefined ? avatarUrl : user.avatar_url;
    let updatedShift = shift !== undefined ? shift : user.shift;
    if (updatedShift) {
      const upper = String(updatedShift).toUpperCase().trim();
      if (upper === 'GUARDIA_A') updatedShift = 'G1';
      else if (upper === 'GUARDIA_B') updatedShift = 'G2';
      else if (upper === 'GUARDIA_C') updatedShift = 'G3';
      else if (upper === 'GUARDIA_D') updatedShift = 'G4';
      else if (['G1', 'G2', 'G3', 'G4'].includes(upper)) updatedShift = upper;
    }
    const updatedDocId = document_id !== undefined ? document_id : user.document_id;
    const updatedRadio = radio_channel !== undefined ? radio_channel : user.radio_channel;
    const updatedPhone = phone_extension !== undefined ? phone_extension : user.phone_extension;
    const updatedRole = primary_role !== undefined ? primary_role : user.primary_role;

    db.prepare(`
      UPDATE users
      SET full_name = ?, email = ?, avatar_url = ?, shift = ?, document_id = ?, radio_channel = ?, phone_extension = ?, primary_role = ?
      WHERE id = ?
    `).run(updatedFullName, updatedEmail, updatedAvatar, updatedShift, updatedDocId, updatedRadio, updatedPhone, updatedRole, user.id);

    // Also synchronize with crew_members table ONLY for non-admin operational personnel
    if (user.role !== 'ADMIN') {
      try {
        const crewUpdate = db.prepare(`
          UPDATE crew_members
          SET 
            name = COALESCE(?, name),
            avatar_url = COALESCE(?, avatar_url),
            document_id = COALESCE(?, document_id),
            radio_channel = COALESCE(?, radio_channel),
            phone_extension = COALESCE(?, phone_extension),
            primary_role = COALESCE(?, primary_role),
            shift_code = COALESCE(?, shift_code)
          WHERE (document_id IS NOT NULL AND document_id != '' AND document_id = ?)
             OR name = ?
        `).run(
          updatedFullName,
          updatedAvatar,
          updatedDocId,
          updatedRadio,
          updatedPhone,
          updatedRole,
          updatedShift,
          // Se ubica la ficha por los datos ANTERIORES del usuario: buscar por el nombre/DNI nuevo
          // sobrescribiría la ficha de otro integrante que ya tenga ese nombre o DNI
          user.document_id || '',
          user.full_name
        );

        if (crewUpdate.changes === 0 && updatedDocId) {
          db.prepare(`
            INSERT OR IGNORE INTO crew_members (id, name, document_id, primary_role, shift_code, radio_channel, phone_extension, status, avatar_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'EN_TURNO', ?)
          `).run(
            'crew-' + user.id,
            updatedFullName,
            updatedDocId,
            updatedRole || 'OPERADOR_BOMBAS',
            updatedShift || 'G1',
            updatedRadio || 'Canal 1 Operaciones',
            updatedPhone || null,
            updatedAvatar || null
          );
        }
      } catch (e) {
        console.warn('[Profile] Error synchronizing with crew_members:', e);
      }
    }

    logAudit(user.id, user.username, 'UPDATE_PROFILE', 'USERS', user.id, `Actualización de perfil (Nombre: ${updatedFullName}, DNI: ${updatedDocId || 'N/A'})`, req.ip || '127.0.0.1');

    return res.json({
      success: true,
      message: 'Perfil y ficha operacional actualizados exitosamente',
      user: {
        id: user.id,
        username: user.username,
        email: updatedEmail,
        fullName: updatedFullName,
        role: user.role,
        shift: updatedShift,
        avatarUrl: updatedAvatar,
        document_id: updatedDocId,
        radio_channel: updatedRadio,
        phone_extension: updatedPhone,
        primary_role: updatedRole
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }

  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }
    if (PUBLIC_DEFAULT_PASSWORDS.has(newPassword)) {
      return res.status(400).json({ success: false, message: 'Esa contraseña es pública y no puede usarse. Elija otra.' });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ success: false, message: 'La nueva contraseña debe ser distinta de la actual' });
    }

    const userId = req.user.userId;
    const username = req.user.username;

    const user = db.prepare('SELECT * FROM users WHERE id = ? OR username = ?').get(userId, username) as any;

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    // Strictly require and verify current password
    if (!currentPassword) {
      return res.status(400).json({ success: false, message: 'Debe ingresar la contraseña actual' });
    }

    let isCurrentMatch = false;
    try {
      isCurrentMatch = bcrypt.compareSync(currentPassword, user.password_hash);
    } catch {
      isCurrentMatch = false;
    }

    if (!isCurrentMatch) {
      return res.status(400).json({ success: false, message: 'La contraseña actual no es correcta' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(newHash, user.id);

    // Cambio voluntario: invalidar las sesiones abiertas con la contraseña anterior en otras terminales.
    // Esta terminal recibe un token nuevo y conserva su canal de tiempo real. Con contraseña temporal
    // no hace falta: el reset del Administrador ya invalidó los tokens previos y las sesiones con la
    // clave temporal solo podían cambiarla (así el primer ingreso no expulsa al usuario).
    if (user.must_change_password !== 1) {
      bumpTokenVersion(user.id);
      const callerDeviceId = req.headers['x-device-id']?.toString();
      disconnectWsClients({ userId: user.id }, 'Contraseña cambiada: inicie sesión nuevamente', callerDeviceId);
    }
    const refreshed = db.prepare('SELECT token_version FROM users WHERE id = ?').get(user.id) as { token_version: number };
    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      shift: user.shift,
      fullName: user.full_name,
      tokenVersion: refreshed.token_version
    });

    logAudit(user.id, user.username, 'CHANGE_PASSWORD', 'USERS', user.id, 'Cambio de contraseña realizado exitosamente', req.ip || '127.0.0.1');

    return res.json({
      success: true,
      message: 'Contraseña actualizada correctamente',
      token
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
