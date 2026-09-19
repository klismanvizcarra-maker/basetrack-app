/**
 * BASETRACK Platform - Centralized API Configuration
 * Supports dynamic hostname resolution for local network devices (tablets, mobiles)
 * as well as localhost desktop environments.
 */

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:3001/api`;
    }
  }
  return 'http://localhost:3001/api';
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
