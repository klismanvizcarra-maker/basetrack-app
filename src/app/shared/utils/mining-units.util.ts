export function formatFlowRate(m3h: number): string {
  return `${Math.round(m3h).toLocaleString('es-PE')} m³/h`;
}

export function formatPressure(bar: number): string {
  return `${bar.toFixed(1)} bar`;
}

export function formatPsi(psi: number): string {
  return `${psi.toFixed(1)} PSI`;
}

export function formatSolids(percentage: number): string {
  return `${percentage.toFixed(1)}% Sólidos`;
}

export function formatMicrons(p80: number): string {
  return `${Math.round(p80)} µm`;
}

export function formatTonnage(ton: number): string {
  if (ton >= 1000) {
    return `${(ton / 1000).toFixed(1)} kTon`;
  }
  return `${Math.round(ton).toLocaleString('es-PE')} Ton`;
}

export function getStatusBadgeClass(status: string): string {
  switch (status?.toUpperCase()) {
    case 'OPERATING':
    case 'OPTIMAL':
    case 'ACCEPTED':
    case 'RESOLVED':
    case 'NORMAL':
      return 'badge-success';
    case 'STANDBY':
    case 'ATTENTION':
    case 'MEDIUM':
    case 'PENDING':
    case 'IN_PROGRESS':
      return 'badge-warning';
    case 'FAULT':
    case 'CRITICAL':
    case 'HIGH':
    case 'EMERGENCY':
    case 'ALERT':
    case 'RESTRICTED':
      return 'badge-danger';
    default:
      return 'badge-purple';
  }
}
