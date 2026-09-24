/**
 * BASETRACK Platform - Centralized API Configuration
 * Supports dynamic hostname resolution for local network devices (tablets, mobiles),
 * cloud backend URLs (e.g. Render, Railway), and localhost environments.
 */

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    // 1. Check for custom cloud backend URL configured by admin
    try {
      const customUrl = localStorage.getItem('basetrack_api_url');
      if (customUrl && customUrl.trim()) {
        let clean = customUrl.trim().replace(/\/+$/, '');
        if (!clean.endsWith('/api')) {
          clean += '/api';
        }
        return clean;
      }
    } catch (e) {
      // In private browsing or restricted environments
    }

    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    // 2. If running on Vercel or any HTTPS domain, avoid calling insecure http://hostname:3001/api (Mixed Content)
    if (protocol === 'https:' && hostname.includes('vercel.app')) {
      return `https://${hostname}/api`;
    }

    // 3. Local area network (LAN IP: 192.168.x.x) or non-localhost HTTP
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:3001/api`;
    }
  }
  return 'http://localhost:3001/api';
}

export function setCustomApiUrl(url: string): void {
  if (typeof localStorage !== 'undefined') {
    if (url && url.trim()) {
      localStorage.setItem('basetrack_api_url', url.trim());
    } else {
      localStorage.removeItem('basetrack_api_url');
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
