export type PermissionKey =
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
  category: 'OPERACIONES' | 'GESTIÓN' | 'SEGURIDAD';
  description: string;
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
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

export const DEFAULT_ROLE_PERMISSIONS: Record<'ADMIN' | 'SUPERVISOR' | 'OPERATOR', PermissionKey[]> = {
  ADMIN: [
    'CAN_VIEW_OPERATIONS',
    'CAN_RECORD_DATA',
    'CAN_FILL_VEHICLES',
    'CAN_MANAGE_CREW',
    'CAN_CLOSE_SHIFT',
    'CAN_DELETE_RECORDS',
    'CAN_ACCESS_ADMIN'
  ],
  SUPERVISOR: [
    'CAN_VIEW_OPERATIONS',
    'CAN_RECORD_DATA',
    'CAN_FILL_VEHICLES',
    'CAN_MANAGE_CREW',
    'CAN_CLOSE_SHIFT'
  ],
  OPERATOR: [
    'CAN_VIEW_OPERATIONS',
    'CAN_RECORD_DATA',
    'CAN_FILL_VEHICLES'
  ]
};
