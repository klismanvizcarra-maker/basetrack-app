/**
 * Utilidades para generación y normalización de Avatares Dinámicos Corporativos
 * de BASETRACK APP.
 * 
 * Reemplaza dependencias de imágenes externas (Unsplash) por monogramas SVG vectoriales
 * de alta definición, ultraligeros, 100% offline y con código cromático por rol.
 */

export interface RoleTheme {
  bg1: string;
  bg2: string;
  text: string;
  label: string;
  icon: string;
}

export function getUserInitials(name?: string): string {
  if (!name || typeof name !== 'string') return 'BT';
  const clean = name.trim();
  if (!clean) return 'BT';

  // Eliminar guiones, puntos y símbolos especiales
  const parts = clean
    .replace(/[-_.,]/g, ' ')
    .split(/\s+/)
    .filter(p => p && !/^(de|del|la|las|los|y|ii|iii|iv)$/i.test(p));

  if (parts.length === 0) return 'BT';
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  // Tomar la primera letra de la primera palabra y la primera letra de la segunda palabra
  // Ej: "Marck Vizcarra" -> "MV", "GONGORA ROJAS" -> "GR", "ALIAGA CASTAÑEDA" -> "AC"
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function getRoleTheme(role?: string): RoleTheme {
  const r = (role || '').toUpperCase();
  if (r === 'ADMIN' || r === 'ADMINISTRADOR') {
    return {
      bg1: '#031795', // Azul Cobalto Oficial BASETRACK
      bg2: '#0f172a', // Obsidiana Profundo
      text: '#ffffff',
      label: 'ADMIN',
      icon: ''
    };
  }
  if (r === 'SUPERVISOR') {
    return {
      bg1: '#1d4ed8', // Azul Real
      bg2: '#1e3a8a', // Azul Marino Cobalto
      text: '#ffffff',
      label: 'SUPERVISOR',
      icon: ''
    };
  }
  if (r === 'MAINTENANCE' || r === 'MANTENIMIENTO') {
    return {
      bg1: '#d97706', // Ámbar Minero
      bg2: '#92400e', // Ámbar Óxido
      text: '#ffffff',
      label: 'MANTENIMIENTO',
      icon: ''
    };
  }
  // Default: OPERADOR / OPERATOR
  return {
    bg1: '#0284c7', // Azul Acero
    bg2: '#0369a1', // Cian Marino
    text: '#ffffff',
    label: 'OPERADOR',
    icon: ''
  };
}

/**
 * Genera un avatar vectorial SVG en formato data-uri autónomo (0 peticiones de red).
 * Diseñado exclusivamente con las iniciales nítidas centradas del usuario (ej. "MV").
 */
export function generateAvatarSvg(name?: string, role?: string, shift?: string): string {
  const initials = getUserInitials(name);
  const theme = getRoleTheme(role);
  const gradId = `avatarGrad_${initials}_${Math.abs(hashString(name || 'BT'))}`;

  // SVG de monograma con iniciales limpias, alta legibilidad a cualquier resolución
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs>
      <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${theme.bg1}"/>
        <stop offset="100%" stop-color="${theme.bg2}"/>
      </linearGradient>
    </defs>
    <!-- Círculo base con gradiente corporativo -->
    <circle cx="60" cy="60" r="56" fill="url(#${gradId})" stroke="rgba(255,255,255,0.25)" stroke-width="2.5"/>
    
    <!-- Anillo decorativo interior sutil -->
    <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>

    <!-- Iniciales en tipografía técnica de alto impacto -->
    <text x="60" y="60" font-family="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Segoe UI', Roboto, sans-serif" font-size="${initials.length > 2 ? '38' : '44'}" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="central" letter-spacing="1">
      ${initials}
    </text>
  </svg>`.replace(/\s+/g, ' ').trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Devuelve el avatar efectivo:
 * - Purga y rechaza cualquier avatar sintético externo (DiceBear, Bottts, Robohash, Unsplash, etc.)
 * - Genera siempre el monograma vectorial nativo con las iniciales (ej. "MV")
 * - Si el usuario subió una fotografía real propia (base64 data:image/png|jpeg o ruta interna /images/), la respeta
 */
export function getEffectiveAvatar(
  avatarUrl?: string | null,
  name?: string,
  role?: string,
  shift?: string
): string {
  if (avatarUrl && typeof avatarUrl === 'string') {
    const clean = avatarUrl.trim();
    const isSynthetic = 
      clean.includes('dicebear') ||
      clean.includes('bottts') ||
      clean.includes('robohash') ||
      clean.includes('unsplash.com') ||
      clean.includes('example.com') ||
      clean.includes('placeholder') ||
      clean.includes('avataaars') ||
      clean.includes('gravatar.com');

    // Respetar solo si es una imagen real subida (foto base64 PNG/JPEG o asset local del proyecto)
    if (clean && !isSynthetic && (clean.startsWith('data:image/') || clean.startsWith('/images/'))) {
      return clean;
    }
  }
  return generateAvatarSvg(name, role, shift);
}
