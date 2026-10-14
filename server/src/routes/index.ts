import { Router } from 'express';
import { login, register, getMe, updateProfile, changePassword } from '../controllers/auth.controller.js';
import { getDashboardMetrics, getMasterSheetEntries, saveMasterSheetEntries } from '../controllers/dashboard.controller.js';
import { 
  getAllPumps, 
  getPumpById, 
  createPumpReport, 
  updatePumpStatus, 
  getPumpOperationalSheet, 
  savePumpOperationalSheet,
  closePumpShift,
  getPumpShiftHistory
} from '../controllers/pumps.controller.js';
import { getAllCyclones, createCycloneReport, getStationSamples, createStationSample, updateStationSample, deleteStationSample } from '../controllers/cyclones.controller.js';
import { getAllTailings, createTailingsReport } from '../controllers/tailings.controller.js';
import { getAllShiftHandovers, createShiftHandover, acceptShiftHandover } from '../controllers/shift.controller.js';
import { getAllMaintenanceRequests, createMaintenanceRequest, updateMaintenanceStatus } from '../controllers/maintenance.controller.js';
import { 
  getAllUsers, 
  createUserByAdmin, 
  createUsersBulk, 
  getAuditLogs, 
  getDatabaseBackup, 
  restoreDatabaseBackup,
  updateUserRoleShift,
  resetUserPassword,
  toggleUserStatus,
  getConnectedDevices,
  revokeDeviceSession,
  deleteDeviceSession,
  purgeStaleDevices,
  getSupervisorOperators,
  assignOperatorToSupervisor,
  removeOperatorFromSupervisor,
  autoAssignByShift,
  getMyOperators,
  getPermissionsMatrix,
  updateRolePermissions,
  updateUserPermissionOverrides,
  resetPermissionsMatrix,
  getMyPermissions,
  getPlantParameters,
  updatePlantParameters,
  resetApp,
  broadcastAppUpdate
} from '../controllers/admin.controller.js';
import { getCrewMembers, createCrewMember, updateCrewMember, deleteCrewMember, getAreaAssignments, saveAreaAssignment, checkinAreaAssignment, getCrewPositions, createCrewPosition, deleteCrewPosition } from '../controllers/crew.controller.js';
import { pushEvents, pullEvents, getSyncStatus } from '../controllers/sync.controller.js';
import {
  getVehiclesSummary,
  getAllVehicles,
  createVehicle,
  updateVehicle,
  toggleVehicleStatus,
  deleteVehicle,
  getVehicleChecklists,
  createVehicleChecklist
} from '../controllers/vehicle.controller.js';
import { authenticateToken, requireRoles, requirePermission } from '../middlewares/auth.middleware.js';

export const apiRouter = Router();

// 1. Health check
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'BASETRACK Industrial Operations API',
    database: 'SQLite (native node:sqlite) WAL mode'
  });
});

// 2. Auth Routes
apiRouter.post('/auth/login', login);
apiRouter.post('/auth/register', register);
apiRouter.get('/auth/me', authenticateToken, getMe);
apiRouter.put('/auth/profile', authenticateToken, updateProfile);
apiRouter.put('/auth/change-password', authenticateToken, changePassword);
apiRouter.post('/auth/change-password', authenticateToken, changePassword);

// 3. Dashboard Routes
apiRouter.get('/dashboard/metrics', authenticateToken, getDashboardMetrics);
apiRouter.get('/dashboard/master-sheet', authenticateToken, getMasterSheetEntries);
apiRouter.post('/dashboard/master-sheet', authenticateToken, requirePermission('CAN_RECORD_DATA'), saveMasterSheetEntries);

// 4. Pumps Telemetry & Operational Sheet Routes
apiRouter.get('/pumps/operational-sheet', authenticateToken, getPumpOperationalSheet);
apiRouter.post('/pumps/operational-sheet', authenticateToken, requirePermission('CAN_RECORD_DATA'), savePumpOperationalSheet);
apiRouter.post('/pumps/shift-closure', authenticateToken, requirePermission('CAN_RECORD_DATA'), closePumpShift);
apiRouter.get('/pumps/shift-history', authenticateToken, getPumpShiftHistory);
apiRouter.get('/pumps', authenticateToken, getAllPumps);
apiRouter.get('/pumps/:id', authenticateToken, getPumpById);
apiRouter.post('/pumps', authenticateToken, requirePermission('CAN_RECORD_DATA'), createPumpReport);
apiRouter.patch('/pumps/:id/status', authenticateToken, requirePermission('CAN_RECORD_DATA'), updatePumpStatus);

// 5. Cyclones Routes
apiRouter.get('/cyclones', authenticateToken, getAllCyclones);
apiRouter.post('/cyclones', authenticateToken, requirePermission('CAN_RECORD_DATA'), createCycloneReport);
apiRouter.get('/cyclones/station-samples', authenticateToken, getStationSamples);
apiRouter.post('/cyclones/station-samples', authenticateToken, requirePermission('CAN_RECORD_DATA'), createStationSample);
apiRouter.put('/cyclones/station-samples/:id', authenticateToken, requirePermission('CAN_RECORD_DATA'), updateStationSample);
apiRouter.delete('/cyclones/station-samples/:id', authenticateToken, requirePermission('CAN_DELETE_RECORDS'), deleteStationSample);

// 6. Tailings & Dam Routes
apiRouter.get('/tailings', authenticateToken, getAllTailings);
apiRouter.post('/tailings', authenticateToken, requirePermission('CAN_RECORD_DATA'), createTailingsReport);

// 7. Shift Handover Routes
apiRouter.get('/shift-handover', authenticateToken, getAllShiftHandovers);
apiRouter.post('/shift-handover', authenticateToken, requirePermission('CAN_CLOSE_SHIFT'), createShiftHandover);
apiRouter.patch('/shift-handover/:id/accept', authenticateToken, requirePermission('CAN_CLOSE_SHIFT'), acceptShiftHandover);

// 8. Maintenance Routes
apiRouter.get('/maintenance', authenticateToken, getAllMaintenanceRequests);
apiRouter.post('/maintenance', authenticateToken, requirePermission('CAN_RECORD_DATA'), createMaintenanceRequest);
apiRouter.patch('/maintenance/:id/status', authenticateToken, requirePermission('CAN_RECORD_DATA'), updateMaintenanceStatus);

// 9. Admin & Backups
apiRouter.get('/admin/users', authenticateToken, requireRoles('ADMIN', 'SUPERVISOR'), getAllUsers);
apiRouter.post('/admin/users', authenticateToken, requireRoles('ADMIN'), createUserByAdmin);
apiRouter.post('/admin/users/bulk', authenticateToken, requireRoles('ADMIN'), createUsersBulk);
apiRouter.post('/admin/bulk-upload', authenticateToken, requireRoles('ADMIN'), createUsersBulk);
apiRouter.get('/admin/audit-logs', authenticateToken, requireRoles('ADMIN'), getAuditLogs);
apiRouter.get('/admin/backup', authenticateToken, requireRoles('ADMIN'), getDatabaseBackup);
apiRouter.post('/admin/restore', authenticateToken, requireRoles('ADMIN'), restoreDatabaseBackup);
apiRouter.post('/admin/reset-app', authenticateToken, requireRoles('ADMIN'), resetApp);
apiRouter.patch('/admin/users/:id/role-shift', authenticateToken, requireRoles('ADMIN'), updateUserRoleShift);
apiRouter.post('/admin/users/:id/reset-password', authenticateToken, requireRoles('ADMIN'), resetUserPassword);
apiRouter.patch('/admin/users/:id/status', authenticateToken, requireRoles('ADMIN'), toggleUserStatus);
apiRouter.get('/admin/devices', authenticateToken, requireRoles('ADMIN', 'SUPERVISOR'), getConnectedDevices);
apiRouter.post('/admin/devices/:deviceId/revoke', authenticateToken, requireRoles('ADMIN'), revokeDeviceSession);
apiRouter.delete('/admin/devices/:deviceId', authenticateToken, requireRoles('ADMIN'), deleteDeviceSession);
apiRouter.post('/admin/devices/purge-stale', authenticateToken, requireRoles('ADMIN'), purgeStaleDevices);
apiRouter.get('/admin/supervisor-operators', authenticateToken, requireRoles('ADMIN', 'SUPERVISOR'), getSupervisorOperators);
apiRouter.post('/admin/supervisor-operators', authenticateToken, requireRoles('ADMIN', 'SUPERVISOR'), assignOperatorToSupervisor);
apiRouter.delete('/admin/supervisor-operators/:supervisor_id/:operator_id', authenticateToken, requireRoles('ADMIN', 'SUPERVISOR'), removeOperatorFromSupervisor);
apiRouter.post('/admin/supervisor-operators/assign', authenticateToken, requireRoles('ADMIN', 'SUPERVISOR'), assignOperatorToSupervisor);
apiRouter.post('/admin/supervisor-operators/remove', authenticateToken, requireRoles('ADMIN', 'SUPERVISOR'), removeOperatorFromSupervisor);
apiRouter.post('/admin/supervisor-operators/auto-assign', authenticateToken, requireRoles('ADMIN', 'SUPERVISOR'), autoAssignByShift);

// Matriz de Permisos & Seguridad (RBAC Híbrido + Excepciones)
apiRouter.get('/admin/permissions', authenticateToken, requireRoles('ADMIN', 'SUPERVISOR'), getPermissionsMatrix);
apiRouter.put('/admin/permissions/roles', authenticateToken, requireRoles('ADMIN'), updateRolePermissions);
apiRouter.put('/admin/permissions/users/:userId', authenticateToken, requireRoles('ADMIN'), updateUserPermissionOverrides);
apiRouter.post('/admin/permissions/reset', authenticateToken, requireRoles('ADMIN'), resetPermissionsMatrix);
apiRouter.get('/auth/permissions', authenticateToken, getMyPermissions);

// Parámetros de Planta & Metas Operacionales
apiRouter.get('/admin/plant-parameters', authenticateToken, getPlantParameters);
apiRouter.put('/admin/plant-parameters', authenticateToken, requireRoles('ADMIN', 'SUPERVISOR'), updatePlantParameters);

// Despliegue & Notificación Global en Tiempo Real
apiRouter.post('/admin/broadcast-update', authenticateToken, requireRoles('ADMIN'), broadcastAppUpdate);

// 10. Crew & Area Assignments Routes (Gestión de Cuadrilla y Asignación por Área)
apiRouter.get('/crew/members', authenticateToken, getCrewMembers);
apiRouter.get('/crew/my-operators', authenticateToken, getMyOperators);
apiRouter.post('/crew/members', authenticateToken, requirePermission('CAN_MANAGE_CREW'), createCrewMember);
apiRouter.put('/crew/members/:id', authenticateToken, requirePermission('CAN_MANAGE_CREW'), updateCrewMember);
apiRouter.delete('/crew/members/:id', authenticateToken, requireRoles('ADMIN'), deleteCrewMember);
apiRouter.get('/crew/assignments', authenticateToken, getAreaAssignments);
apiRouter.post('/crew/assignments', authenticateToken, requirePermission('CAN_MANAGE_CREW'), saveAreaAssignment);
apiRouter.patch('/crew/assignments/:id/checkin', authenticateToken, requirePermission('CAN_RECORD_DATA'), checkinAreaAssignment);
apiRouter.get('/crew/positions', authenticateToken, getCrewPositions);
apiRouter.post('/crew/positions', authenticateToken, requirePermission('CAN_MANAGE_CREW'), createCrewPosition);
apiRouter.delete('/crew/positions/:key', authenticateToken, requireRoles('ADMIN'), deleteCrewPosition);

// 11. Cloud Realtime Sync Routes (Sincronización Multi-Dispositivo)
apiRouter.post('/sync/push', authenticateToken, pushEvents);
apiRouter.get('/sync/pull', authenticateToken, pullEvents);
// Público: solo expone contadores agregados; se usa para probar conectividad con un backend remoto.
apiRouter.get('/sync/status', getSyncStatus);

// 12. Vehicle Pre-Use Checklists & Fleet Management (Padrón de Camionetas Mineras 4x4)
apiRouter.get('/vehicles', authenticateToken, getAllVehicles);
apiRouter.get('/vehicles/summary', authenticateToken, getVehiclesSummary);
apiRouter.post('/vehicles', authenticateToken, requireRoles('ADMIN'), createVehicle);
apiRouter.put('/vehicles/:id', authenticateToken, requireRoles('ADMIN'), updateVehicle);
apiRouter.patch('/vehicles/:id/status', authenticateToken, requireRoles('ADMIN'), toggleVehicleStatus);
apiRouter.delete('/vehicles/:id', authenticateToken, requireRoles('ADMIN'), deleteVehicle);

apiRouter.get('/vehicles/checklists', authenticateToken, getVehicleChecklists);
apiRouter.post('/vehicles/checklists', authenticateToken, requirePermission('CAN_FILL_VEHICLES'), createVehicleChecklist);

