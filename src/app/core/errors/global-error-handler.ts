import { ErrorHandler, Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GlobalErrorHandler implements ErrorHandler {

  handleError(error: any): void {
    const errorStr = error?.message || error?.toString?.() || '';

    // Catch stale chunk import failures during rebuilds, HMR or deployments
    const isChunkFailure =
      errorStr.includes('Failed to fetch dynamically imported module') ||
      errorStr.includes('Loading chunk') ||
      errorStr.includes('error loading dynamically imported module');

    if (isChunkFailure && typeof window !== 'undefined') {
      const lastReload = sessionStorage.getItem('basetrack_chunk_reload');
      const now = Date.now();

      // Only reload if we haven't reloaded for a chunk failure within the last 10 seconds (prevents loops)
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem('basetrack_chunk_reload', now.toString());
        console.warn('[GlobalErrorHandler] Stale chunk detected after app rebuild. Refreshing application manifest...', errorStr);
        window.location.reload();
        return;
      }
    }

    // Default console reporting
    console.error('[GlobalErrorHandler] Uncaught application error:', error);
  }
}
