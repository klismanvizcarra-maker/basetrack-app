/**
 * Safe Clipboard Utility for BASETRACK APP
 * Works seamlessly in HTTPS, HTTP local networks, mobiles, and legacy browsers.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 1. Try modern Async Clipboard API if available and permitted
  if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to textarea fallback
    }
  }

  // 2. Fallback for non-secure HTTP contexts (e.g. LAN IP 192.168.x.x, tablets)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.warn('[Clipboard] Fallback copy failed:', err);
    return false;
  }
}
