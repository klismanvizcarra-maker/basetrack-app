import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApiBaseUrl } from '../constants/api.config';
import { AuthService } from '../auth/auth.service';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const binary = String.fromCharCode.apply(null, Array.from(new Uint8Array(buffer)));
  return window.btoa(binary);
}

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  public isSupported = signal<boolean>(false);
  public permissionState = signal<NotificationPermission>('default');
  public isSubscribed = signal<boolean>(false);
  public isLoading = signal<boolean>(false);
  public isTesting = signal<boolean>(false);
  public statusMessage = signal<string | null>(null);

  constructor() {
    this.checkSupportAndSubscription();
  }

  public async checkSupportAndSubscription(): Promise<void> {
    if (typeof window === 'undefined') return;

    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    this.isSupported.set(supported);

    if (!supported) return;

    this.permissionState.set(Notification.permission);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      this.isSubscribed.set(!!sub);
    } catch (err) {
      console.warn('[Push] Error al verificar suscripción push existente:', err);
    }
  }

  public async subscribe(): Promise<boolean> {
    if (!this.isSupported()) {
      this.statusMessage.set('Las notificaciones push no están soportadas en este navegador o modo.');
      return false;
    }

    this.isLoading.set(true);
    this.statusMessage.set(null);

    try {
      // 1. Request user permission
      const permission = await Notification.requestPermission();
      this.permissionState.set(permission);

      if (permission !== 'granted') {
        this.statusMessage.set(
          permission === 'denied'
            ? 'Permiso bloqueado. Debes habilitar las notificaciones en los ajustes del navegador/dispositivo.'
            : 'Permiso no otorgado.'
        );
        this.isLoading.set(false);
        return false;
      }

      // 2. Fetch VAPID public key from backend
      const res = await firstValueFrom(
        this.http.get<{ publicKey: string }>(`${getApiBaseUrl()}/notifications/vapid-public-key`)
      );

      if (!res || !res.publicKey) {
        throw new Error('No se recibió la clave pública VAPID del servidor');
      }

      // 3. Register push subscription with the Service Worker
      const reg = await navigator.serviceWorker.ready;
      const convertedVapidKey = urlBase64ToUint8Array(res.publicKey);

      // Unsubscribe any stale subscription first if present
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        try { await existingSub.unsubscribe(); } catch {}
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as any
      });

      // 4. Send subscription keys to backend
      const rawP256dh = subscription.getKey('p256dh');
      const rawAuth = subscription.getKey('auth');

      const payload = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(rawP256dh),
          auth: arrayBufferToBase64(rawAuth)
        },
        deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Client'
      };

      await firstValueFrom(
        this.http.post(`${getApiBaseUrl()}/notifications/subscribe`, payload)
      );

      this.isSubscribed.set(true);
      this.statusMessage.set('✓ ¡Notificaciones activadas! Este teléfono recibirá alertas críticas.');
      this.isLoading.set(false);
      return true;
    } catch (err: any) {
      console.error('[Push] Error al suscribir a notificaciones push:', err);
      this.statusMessage.set(`Error al activar notificaciones: ${err?.message || 'Fallo de conexión'}`);
      this.isLoading.set(false);
      return false;
    }
  }

  public async unsubscribe(): Promise<boolean> {
    if (!this.isSupported()) return false;

    this.isLoading.set(true);
    this.statusMessage.set(null);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        try {
          await firstValueFrom(
            this.http.post(`${getApiBaseUrl()}/notifications/unsubscribe`, { endpoint })
          );
        } catch {}
      }

      this.isSubscribed.set(false);
      this.statusMessage.set('Notificaciones desactivadas para este dispositivo.');
      this.isLoading.set(false);
      return true;
    } catch (err: any) {
      console.error('[Push] Error al desuscribir:', err);
      this.statusMessage.set(`Error al desactivar: ${err?.message}`);
      this.isLoading.set(false);
      return false;
    }
  }

  public async sendTestNotification(): Promise<boolean> {
    if (!this.isSubscribed()) {
      this.statusMessage.set('Primero debes activar las notificaciones en este dispositivo.');
      return false;
    }

    this.isTesting.set(true);
    this.statusMessage.set(null);

    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; sentCount: number; message: string }>(
          `${getApiBaseUrl()}/notifications/test`,
          {}
        )
      );

      this.statusMessage.set(res.message || 'Notificación de prueba enviada.');
      this.isTesting.set(false);
      return true;
    } catch (err: any) {
      console.error('[Push] Error al enviar prueba push:', err);
      this.statusMessage.set(`Fallo en prueba: ${err?.error?.error || err?.message}`);
      this.isTesting.set(false);
      return false;
    }
  }
}
