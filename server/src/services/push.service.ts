import webpush from 'web-push';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db } from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const vapidJsonPath = path.resolve(__dirname, '../../data/vapid.json');

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  tag?: string;
  requireInteraction?: boolean;
}

export interface StoredSubscription {
  id: string;
  user_id: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  device_info: string | null;
  created_at: string;
  updated_at: string;
}

class PushService {
  private publicKey: string = '';
  private privateKey: string = '';
  private subject: string = process.env.VAPID_SUBJECT || 'mailto:operations@basetrack.com';
  private initialized: boolean = false;

  constructor() {
    this.initVapid();
  }

  private initVapid(): void {
    if (this.initialized) return;

    // 1. Try from environment variables first
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      this.publicKey = process.env.VAPID_PUBLIC_KEY;
      this.privateKey = process.env.VAPID_PRIVATE_KEY;
    } else {
      // 2. Try loading from persistent file server/data/vapid.json
      try {
        if (fs.existsSync(vapidJsonPath)) {
          const raw = fs.readFileSync(vapidJsonPath, 'utf8');
          const data = JSON.parse(raw);
          if (data.publicKey && data.privateKey) {
            this.publicKey = data.publicKey;
            this.privateKey = data.privateKey;
          }
        }
      } catch (err) {
        console.warn('[PushService] Could not read existing vapid.json:', err);
      }

      // 3. If still empty, generate new VAPID keys and persist
      if (!this.publicKey || !this.privateKey) {
        try {
          const keys = webpush.generateVAPIDKeys();
          this.publicKey = keys.publicKey;
          this.privateKey = keys.privateKey;

          const dir = path.dirname(vapidJsonPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(vapidJsonPath, JSON.stringify({
            publicKey: this.publicKey,
            privateKey: this.privateKey,
            createdAt: new Date().toISOString()
          }, null, 2), 'utf8');
          console.log('[PushService] Generated and persisted new VAPID keys to', vapidJsonPath);
        } catch (genErr) {
          console.error('[PushService] Failed to generate VAPID keys:', genErr);
          return;
        }
      }
    }

    try {
      webpush.setVapidDetails(this.subject, this.publicKey, this.privateKey);
      this.initialized = true;
      console.log('[PushService] Web Push VAPID initialized successfully. Public key ready.');
    } catch (setErr) {
      console.error('[PushService] Failed to set VAPID details:', setErr);
    }
  }

  public getVapidPublicKey(): string {
    return this.publicKey;
  }

  public saveSubscription(
    userId: string | null,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    deviceInfo?: string
  ): void {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      throw new Error('Suscripción Web Push inválida: falta endpoint o claves');
    }

    const { endpoint, keys } = subscription;
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?').get(endpoint) as { id: string } | undefined;

    if (existing) {
      db.prepare(`
        UPDATE push_subscriptions
        SET user_id = ?, p256dh = ?, auth = ?, device_info = ?, updated_at = ?
        WHERE endpoint = ?
      `).run(userId, keys.p256dh, keys.auth, deviceInfo || null, now, endpoint);
    } else {
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, device_info, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, userId, endpoint, keys.p256dh, keys.auth, deviceInfo || null, now, now);
    }
  }

  public removeSubscription(endpoint: string): void {
    if (!endpoint) return;
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  }

  public async sendPushNotification(
    payload: PushPayload,
    options?: { userId?: string; role?: string; broadcastAll?: boolean }
  ): Promise<{ sent: number; failed: number }> {
    if (!this.initialized) {
      this.initVapid();
      if (!this.initialized) {
        console.warn('[PushService] Push service not initialized, skipping notification.');
        return { sent: 0, failed: 0 };
      }
    }

    let rows: StoredSubscription[] = [];

    if (options?.userId) {
      rows = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(options.userId) as unknown as StoredSubscription[];
    } else if (options?.role) {
      rows = db.prepare(`
        SELECT s.* FROM push_subscriptions s
        JOIN users u ON s.user_id = u.id
        WHERE u.role = ?
      `).all(options.role) as unknown as StoredSubscription[];
    } else {
      rows = db.prepare('SELECT * FROM push_subscriptions').all() as unknown as StoredSubscription[];
    }

    if (!rows || rows.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const jsonPayload = JSON.stringify({
      title: payload.title || 'BASETRACK Operaciones',
      body: payload.body || 'Alerta operacional en planta.',
      icon: payload.icon || '/icons/icon-192.png',
      badge: payload.badge || '/icons/favicon-48x48.png',
      data: payload.data || { url: '/dashboard' },
      tag: payload.tag || ('basetrack-' + Date.now()),
      requireInteraction: payload.requireInteraction || false
    });

    let sent = 0;
    let failed = 0;

    const promises = rows.map(async (row) => {
      const sub = {
        endpoint: row.endpoint,
        keys: {
          p256dh: row.p256dh,
          auth: row.auth
        }
      };

      try {
        await webpush.sendNotification(sub, jsonPayload);
        sent++;
      } catch (err: any) {
        failed++;
        // 404 or 410 indicates expired or unregistered subscription
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          console.log('[PushService] Subscription expired or revoked, removing from DB:', row.endpoint.slice(0, 40) + '...');
          try {
            db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(row.endpoint);
          } catch (delErr) {
            console.error('[PushService] Failed to delete expired subscription:', delErr);
          }
        } else {
          console.warn('[PushService] Error delivering push notification:', err?.statusCode || err?.message);
        }
      }
    });

    await Promise.allSettled(promises);
    return { sent, failed };
  }

  public async sendTestNotification(userId: string): Promise<{ sent: number; failed: number }> {
    return this.sendPushNotification({
      title: '🔔 BASETRACK Operaciones',
      body: '¡Notificaciones activas! Este dispositivo recibirá alertas operacionales y de seguridad aunque la app esté en segundo plano.',
      data: { url: '/dashboard' },
      tag: 'test-notification'
    }, { userId });
  }
}

export const pushService = new PushService();
