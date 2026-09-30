import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db } from '../database/db.js';
import { generateToken } from '../config/jwt.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../middlewares/error.middleware.js';

export async function login(req: Request, res: Response) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos' });
  }

  const cleanUser = String(username || '').trim();
  const cleanPass = String(password || '').trim();

  // Resilient lookup: admin, marckv, 91209966 or Marck Vizcarra resolves to Marckv (Official Administrator)
  let user: any = null;
  const isTargetingAdmin = ['admin', 'marckv', '91209966', 'marck vizcarra', '2794vizcarra'].includes(cleanUser.toLowerCase());

  if (isTargetingAdmin) {
    user = db.prepare('SELECT * FROM users WHERE LOWER(username) = ? OR document_id = ?').get('marckv', '91209966') as any;
    if (!user) {
      user = db.prepare("SELECT * FROM users WHERE role = 'ADMIN'").get() as any;
    }
  } else {
    user = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) OR document_id = ? OR LOWER(full_name) = LOWER(?)').get(cleanUser, cleanUser, cleanUser, cleanUser) as any;
    if (!user) {
      // Allow login with operator DNI
      const crew = db.prepare('SELECT name FROM crew_members WHERE document_id = ?').get(cleanUser) as { name: string } | undefined;
      if (crew) {
        user = db.prepare('SELECT * FROM users WHERE LOWER(full_name) = LOWER(?)').get(crew.name) as any;
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

  // Fallback for legacy plaintext password upgrade
  if (!match && user.password_hash === cleanPass) {
    match = true;
    try {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(cleanPass, 10), user.id);
    } catch {}
  }

  if (!match) {
    return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
  }

  const token = generateToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    shift: user.shift,
    fullName: user.full_name
  });

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
      document_id: user.document_id,
      radio_channel: user.radio_channel,
      phone_extension: user.phone_extension,
      primary_role: user.primary_role
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
    const user = db.prepare('SELECT id, username, email, full_name, role, shift, avatar_url, document_id, radio_channel, phone_extension, primary_role, created_at FROM users WHERE id = ?').get(req.user.userId) as any;

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
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
        createdAt: user.created_at
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

    // Also synchronize with crew_members table
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
        WHERE (document_id IS NOT NULL AND document_id = ?) 
           OR name = ?
      `).run(
        updatedFullName, 
        updatedAvatar, 
        updatedDocId, 
        updatedRadio, 
        updatedPhone, 
        updatedRole, 
        updatedShift,
        updatedDocId || '',
        updatedFullName
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

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres' });
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
    if (!isCurrentMatch && user.password_hash === currentPassword) {
      isCurrentMatch = true;
    }

    if (!isCurrentMatch) {
      return res.status(400).json({ success: false, message: 'La contraseña actual no es correcta' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);

    logAudit(user.id, user.username, 'CHANGE_PASSWORD', 'USERS', user.id, 'Cambio de contraseña realizado exitosamente', req.ip || '127.0.0.1');

    return res.json({
      success: true,
      message: 'Contraseña actualizada correctamente'
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
