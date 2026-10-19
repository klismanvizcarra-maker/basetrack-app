export type PermissionKey =
  // Ventanas & Módulos Principales
  | 'VIEW_DASHBOARD'
  | 'VIEW_SHIFT_HANDOVER'
  | 'VIEW_CREW'
  | 'VIEW_ROSTER'
  | 'VIEW_PUMPS'
  | 'VIEW_CYCLONES'
  | 'VIEW_TAILINGS'
  | 'VIEW_FLOWSHEET'
  | 'VIEW_MAINTENANCE'
  | 'VIEW_CALCULATORS'
  | 'VIEW_VEHICLE_CHECKLIST'
  | 'VIEW_ADMIN'
  // Capacidades Operacionales & Seguridad
  | 'CAN_VIEW_OPERATIONS'
  | 'CAN_RECORD_DATA'
  | 'CAN_FILL_VEHICLES'
  | 'CAN_MANAGE_CREW'
  | 'CAN_CLOSE_SHIFT'
  | 'CAN_DELETE_RECORDS'
  | 'CAN_ACCESS_ADMIN';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  category: 'VENTANAS' | 'OPERACIONES' | 'GESTIÓN' | 'SEGURIDAD';
  description: string;
  route?: string;
  icon?: string;
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // 1. Ventanas / Módulos del Sistema
  {
    key: 'VIEW_DASHBOARD',
    label: 'Ventana: Dashboard General',
    category: 'VENTANAS',
    description: 'Acceso al panel principal, telemetría consolidada y KPIs de planta (/dashboard).',
    route: '/dashboard',
    icon: 'layout-dashboard'
  },
  {
    key: 'VIEW_SHIFT_HANDOVER',
    label: 'Ventana: Cambio de Guardia',
    category: 'VENTANAS',
    description: 'Acceso a la bitácora de relevo y entrega oficial de turno (/shift-handover).',
    route: '/shift-handover',
    icon: 'file-text'
  },
  {
    key: 'VIEW_CREW',
    label: 'Ventana: Gestión de Cuadrilla',
    category: 'VENTANAS',
    description: 'Acceso a asignaciones de operadores por puestos operativos (/crew).',
    route: '/crew',
    icon: 'users'
  },
  {
    key: 'VIEW_ROSTER',
    label: 'Ventana: Rol de Guardias (8x8)',
    category: 'VENTANAS',
    description: 'Acceso al calendario operacional 8x8 y rotación de subidas/bajadas (/roster).',
    route: '/roster',
    icon: 'calendar'
  },
  {
    key: 'VIEW_PUMPS',
    label: 'Ventana: Reporte de Bombas',
    category: 'VENTANAS',
    description: 'Acceso a estaciones de bombeo, curvas operacionales y amperajes (/pumps).',
    route: '/pumps',
    icon: 'disc'
  },
  {
    key: 'VIEW_CYCLONES',
    label: 'Ventana: Reporte de Ciclones',
    category: 'VENTANAS',
    description: 'Acceso a baterías de hidrociclones, granulometría y presiones (/cyclones).',
    route: '/cyclones',
    icon: 'sparkles'
  },
  {
    key: 'VIEW_TAILINGS',
    label: 'Ventana: Presa de Relaves & Descarga',
    category: 'VENTANAS',
    description: 'Acceso a niveles de espejo de agua, borde libre y piezómetros (/tailings).',
    route: '/tailings',
    icon: 'activity'
  },
  {
    key: 'VIEW_FLOWSHEET',
    label: 'Ventana: Diagrama P&ID',
    category: 'VENTANAS',
    description: 'Acceso al diagrama interactivo de tuberías e instrumentación (/flowsheet).',
    route: '/flowsheet',
    icon: 'git-merge'
  },
  {
    key: 'VIEW_MAINTENANCE',
    label: 'Ventana: Mantenimiento',
    category: 'VENTANAS',
    description: 'Acceso a órdenes de trabajo (OT), averías mecánicas/eléctricas y pases (/maintenance).',
    route: '/maintenance',
    icon: 'wrench'
  },
  {
    key: 'VIEW_CALCULATORS',
    label: 'Ventana: Calculadora Planta',
    category: 'VENTANAS',
    description: 'Acceso a cálculos metalúrgicos, balances de masa y velocidad crítica (/calculators).',
    route: '/calculators',
    icon: 'calculator'
  },
  {
    key: 'VIEW_VEHICLE_CHECKLIST',
    label: 'Ventana: Checklist Camionetas',
    category: 'VENTANAS',
    description: 'Acceso al módulo de inspección pre-uso de camionetas 4x4 DS-024 (/vehicle-checklist).',
    route: '/vehicle-checklist',
    icon: 'truck'
  },
  {
    key: 'VIEW_ADMIN',
    label: 'Ventana: Administración',
    category: 'VENTANAS',
    description: 'Acceso exclusivo al panel central de administración y auditoría (/admin).',
    route: '/admin',
    icon: 'shield'
  },

  // 2. Capacidades Operacionales & Seguridad
  {
    key: 'CAN_VIEW_OPERATIONS',
    label: 'Visualizar Operaciones & Telemetría',
    category: 'OPERACIONES',
    description: 'Acceso a tableros, curvas históricas, reportes de bombas, ciclones y relaves.'
  },
  {
    key: 'CAN_RECORD_DATA',
    label: 'Registrar Datos de Planta',
    category: 'OPERACIONES',
    description: 'Ingreso y guardado de lecturas operacionales en Bombas, Ciclones y Descarga.'
  },
  {
    key: 'CAN_FILL_VEHICLES',
    label: 'Checklist Pre-Uso de Camionetas',
    category: 'OPERACIONES',
    description: 'Llenado y firma digital de inspecciones pre-uso de camionetas 4x4 (DS-024).'
  },
  {
    key: 'CAN_MANAGE_CREW',
    label: 'Asignar Cuadrilla de Guardia',
    category: 'GESTIÓN',
    description: 'Modificar y asignar operadores titulares en los puestos operativos (/crew).'
  },
  {
    key: 'CAN_CLOSE_SHIFT',
    label: 'Firmar y Cerrar Cambio de Guardia',
    category: 'GESTIÓN',
    description: 'Firma oficial y cierre definitivo de bitácora en entrega de guardia (/shift-handover).'
  },
  {
    key: 'CAN_DELETE_RECORDS',
    label: 'Eliminar Registros Históricos',
    category: 'SEGURIDAD',
    description: 'Eliminación de muestras de laboratorio, reportes o tickets de mantenimiento.'
  },
  {
    key: 'CAN_ACCESS_ADMIN',
    label: 'Acceso Total a Administración',
    category: 'SEGURIDAD',
    description: 'Panel de usuarios, trazabilidad SCADA, backups y gestión de flota (/admin).'
  }
];

export const DEFAULT_ROLE_PERMISSIONS: Record<'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'MAINTENANCE', PermissionKey[]> = {
  ADMIN: [
    'VIEW_DASHBOARD',
    'VIEW_SHIFT_HANDOVER',
    'VIEW_CREW',
    'VIEW_ROSTER',
    'VIEW_PUMPS',
    'VIEW_CYCLONES',
    'VIEW_TAILINGS',
    'VIEW_FLOWSHEET',
    'VIEW_MAINTENANCE',
    'VIEW_CALCULATORS',
    'VIEW_VEHICLE_CHECKLIST',
    'VIEW_ADMIN',
    'CAN_VIEW_OPERATIONS',
    'CAN_RECORD_DATA',
    'CAN_FILL_VEHICLES',
    'CAN_MANAGE_CREW',
    'CAN_CLOSE_SHIFT',
    'CAN_DELETE_RECORDS',
    'CAN_ACCESS_ADMIN'
  ],
  SUPERVISOR: [
    'VIEW_DASHBOARD',
    'VIEW_SHIFT_HANDOVER',
    'VIEW_CREW',
    'VIEW_ROSTER',
    'VIEW_PUMPS',
    'VIEW_CYCLONES',
    'VIEW_TAILINGS',
    'VIEW_FLOWSHEET',
    'VIEW_MAINTENANCE',
    'VIEW_CALCULATORS',
    'VIEW_VEHICLE_CHECKLIST',
    'CAN_VIEW_OPERATIONS',
    'CAN_RECORD_DATA',
    'CAN_FILL_VEHICLES',
    'CAN_MANAGE_CREW',
    'CAN_CLOSE_SHIFT'
  ],
  OPERATOR: [
    'VIEW_DASHBOARD',
    'VIEW_SHIFT_HANDOVER',
    'VIEW_ROSTER',
    'VIEW_PUMPS',
    'VIEW_CYCLONES',
    'VIEW_TAILINGS',
    'VIEW_FLOWSHEET',
    'VIEW_VEHICLE_CHECKLIST',
    'CAN_VIEW_OPERATIONS',
    'CAN_RECORD_DATA',
    'CAN_FILL_VEHICLES'
  ],
  MAINTENANCE: [
    'VIEW_DASHBOARD',
    'VIEW_ROSTER',
    'VIEW_PUMPS',
    'VIEW_CYCLONES',
    'VIEW_TAILINGS',
    'VIEW_FLOWSHEET',
    'VIEW_MAINTENANCE',
    'VIEW_VEHICLE_CHECKLIST',
    'CAN_VIEW_OPERATIONS',
    'CAN_RECORD_DATA',
    'CAN_FILL_VEHICLES'
  ]
};
