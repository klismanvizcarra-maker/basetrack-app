import { Request, Response } from 'express';
import { pushService } from '../services/push.service.js';

export async function getVapidPublicKey(req: Request, res: Response) {
  try {
    const key = pushService.getVapidPublicKey();
    res.json({ publicKey: key });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener clave VAPID pública', details: error?.message });
  }
}

export async function subscribeToPush(req: Request, res: Response) {
  try {
    const { endpoint, keys, deviceInfo } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'Endpoint y claves p256dh/auth son obligatorias' });
    }

    const userId = (req as any).user?.id || null;
    pushService.saveSubscription(userId, { endpoint, keys }, deviceInfo);

    res.json({
      success: true,
      message: 'Dispositivo suscrito exitosamente a notificaciones en segundo plano'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al registrar suscripción push', details: error?.message });
  }
}

export async function unsubscribeFromPush(req: Request, res: Response) {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint es obligatorio' });
    }

    pushService.removeSubscription(endpoint);
    res.json({ success: true, message: 'Dispositivo desuscrito exitosamente' });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al desuscribir dispositivo', details: error?.message });
  }
}

export async function sendTestNotification(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const result = await pushService.sendTestNotification(userId);
    res.json({
      success: true,
      sentCount: result.sent,
      failedCount: result.failed,
      message: result.sent > 0
        ? `Notificación de prueba enviada a ${result.sent} dispositivo(s)`
        : 'No se encontraron dispositivos registrados para este usuario. Activa las notificaciones primero.'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al enviar notificación de prueba', details: error?.message });
  }
}
