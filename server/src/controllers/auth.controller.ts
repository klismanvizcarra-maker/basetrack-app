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

  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username) as any;

  if (!user) {
    return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
  }

  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
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
      avatarUrl: user.avatar_url
    }
  });
}

export async function register(req: Request, res: Response) {
  const { username, email, password, fullName, role, shift } = req.body;

  if (!username || !email || !password || !fullName) {
    return res.status(400).json({ success: false, message: 'Todos los campos obligatorios deben completarse' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    return res.status(409).json({ success: false, message: 'El nombre de usuario o correo ya está registrado' });
  }

  const id = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);
  const userRole = role || 'OPERATOR';
  const userShift = shift || 'GUARDIA_A';
  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;

  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, full_name, role, shift, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, username, email, passwordHash, fullName, userRole, userShift, avatarUrl);

  logAudit(id, username, 'REGISTER', 'USERS', id, `Usuario registrado con rol ${userRole}`, req.ip || '127.0.0.1');

  return res.status(201).json({
    success: true,
    message: 'Usuario registrado correctamente',
    userId: id
  });
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }

  try {
    const user = db.prepare('SELECT id, username, email, full_name, role, shift, avatar_url, created_at FROM users WHERE id = ?').get(req.user.userId) as any;

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
    const { fullName, email, avatarUrl, shift } = req.body;
    const userId = req.user.userId;
    const username = req.user.username;

    // Check if user exists by ID or username
    let user = db.prepare('SELECT * FROM users WHERE id = ? OR username = ?').get(userId, username) as any;

    if (!user) {
      // Fallback: If user is admin-001 from demo token and not in DB by ID, find by username
      user = db.prepare('SELECT * FROM users WHERE username = ?').get('admin') as any;
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en la base de datos' });
    }

    const updatedFullName = fullName !== undefined ? fullName : user.full_name;
    const updatedEmail = email !== undefined ? email : user.email;
    const updatedAvatar = avatarUrl !== undefined ? avatarUrl : user.avatar_url;
    const updatedShift = shift !== undefined ? shift : user.shift;

    db.prepare(`
      UPDATE users
      SET full_name = ?, email = ?, avatar_url = ?, shift = ?
      WHERE id = ?
    `).run(updatedFullName, updatedEmail, updatedAvatar, updatedShift, user.id);

    logAudit(user.id, user.username, 'UPDATE_PROFILE', 'USERS', user.id, `Actualización de perfil (Nombre: ${updatedFullName})`, req.ip || '127.0.0.1');

    return res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: {
        id: user.id,
        username: user.username,
        email: updatedEmail,
        fullName: updatedFullName,
        role: user.role,
        shift: updatedShift,
        avatarUrl: updatedAvatar
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

    let user = db.prepare('SELECT * FROM users WHERE id = ? OR username = ?').get(userId, username) as any;
    if (!user) {
      user = db.prepare('SELECT * FROM users WHERE username = ?').get('admin') as any;
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    // Verify current password if provided
    if (currentPassword && user.password_hash) {
      const match = bcrypt.compareSync(currentPassword, user.password_hash);
      if (!match) {
        return res.status(400).json({ success: false, message: 'La contraseña actual no es correcta' });
      }
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
