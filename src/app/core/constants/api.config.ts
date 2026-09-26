/**
 * BASETRACK Platform - Centralized API Configuration
 * Supports dynamic hostname resolution for local network devices (tablets, mobiles),
 * cloud backend URLs (e.g. Render, Railway), and localhost environments.
 */

/**
 * URL del backend en la nube (Render, Railway, etc.).
 * Si desplegaste tu backend en Render.com, coloca tu URL aquí para que TODOS
 * los dispositivos (celulares, tablets y computadoras) se conecten automáticamente.
 * Ejemplo: 'https://basetrack-backend.onrender.com/api'
 */
export const DEFAULT_CLOUD_BACKEND_URL: string = 'https://basetrack-app.onrender.com/api';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    // 1. Check for custom cloud backend URL configured by admin on this terminal
    try {
      const customUrl = localStorage.getItem('basetrack_api_url');
      if (customUrl && customUrl.trim()) {
        let clean = customUrl.trim().replace(/\/+$/, '');
        if (clean.includes('vercel.app')) {
          localStorage.removeItem('basetrack_api_url');
        } else {
          if (!clean.endsWith('/api')) {
            clean += '/api';
          }
          return clean;
        }
      }
    } catch (e) {
      // In private browsing or restricted environments
    }

    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    // 2. If running locally on localhost/127.0.0.1, prioritize local dev server
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001/api';
    }

    // 3. Global Cloud Backend URL (used by Vercel, mobile phones, tablets and cloud production)
    if (DEFAULT_CLOUD_BACKEND_URL && DEFAULT_CLOUD_BACKEND_URL.trim()) {
      let clean = DEFAULT_CLOUD_BACKEND_URL.trim().replace(/\/+$/, '');
      if (!clean.endsWith('/api')) {
        clean += '/api';
      }
      return clean;
    }

    // 4. Fallback for Local Area Network (LAN IP: 192.168.x.x) or non-localhost HTTP
    if (hostname && protocol !== 'https:') {
      return `http://${hostname}:3001/api`;
    }
  }
  return 'http://localhost:3001/api';
}

export function setCustomApiUrl(url: string): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      if (url && url.trim()) {
        localStorage.setItem('basetrack_api_url', url.trim());
      } else {
        localStorage.removeItem('basetrack_api_url');
      }
    } catch (e) {
      console.warn('[ApiConfig] Error writing custom api url to storage:', e);
    }
  }
}

export function getCustomApiUrl(): string {
  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem('basetrack_api_url') || '';
    } catch {
      return '';
    }
  }
  return '';
}

export const API_ENDPOINTS = {
  auth: () => `${getApiBaseUrl()}/auth`,
  dashboard: () => `${getApiBaseUrl()}/dashboard`,
  pumps: () => `${getApiBaseUrl()}/pumps`,
  cyclones: () => `${getApiBaseUrl()}/cyclones`,
  tailings: () => `${getApiBaseUrl()}/tailings`,
  shiftHandover: () => `${getApiBaseUrl()}/shift-handover`,
  maintenance: () => `${getApiBaseUrl()}/maintenance`,
  admin: () => `${getApiBaseUrl()}/admin`,
  crew: () => `${getApiBaseUrl()}/crew`,
  sync: () => `${getApiBaseUrl()}/sync`
};
