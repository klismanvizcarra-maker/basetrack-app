import { Router } from 'express';
import { login, register, getMe, updateProfile, changePassword } from '../controllers/auth.controller.js';
import { getDashboardMetrics } from '../controllers/dashboard.controller.js';
import { getAllPumps, getPumpById, createPumpReport, updatePumpStatus, getPumpOperationalSheet, savePumpOperationalSheet } from '../controllers/pumps.controller.js';
import { getAllCyclones, createCycloneReport, getStationSamples, createStationSample, deleteStationSample } from '../controllers/cyclones.controller.js';
import { getAllTailings, createTailingsReport } from '../controllers/tailings.controller.js';
import { getAllShiftHandovers, createShiftHandover, acceptShiftHandover } from '../controllers/shift.controller.js';
import { getAllMaintenanceRequests, createMaintenanceRequest, updateMaintenanceStatus } from '../controllers/maintenance.controller.js';
import { getAllUsers, createUserByAdmin, createUsersBulk, getAuditLogs, getDatabaseBackup, restoreDatabaseBackup } from '../controllers/admin.controller.js';
import { getCrewMembers, createCrewMember, updateCrewMember, deleteCrewMember, getAreaAssignments, saveAreaAssignment, checkinAreaAssignment, getCrewPositions, createCrewPosition, deleteCrewPosition } from '../controllers/crew.controller.js';
import { pushEvents, pullEvents, getSyncStatus } from '../controllers/sync.controller.js';
import { authenticateToken, requireRoles } from '../middlewares/auth.middleware.js';

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

// 3. Dashboard Routes
apiRouter.get('/dashboard/metrics', getDashboardMetrics);

// 4. Pumps Telemetry & Operational Sheet Routes
apiRouter.get('/pumps/operational-sheet', getPumpOperationalSheet);
apiRouter.post('/pumps/operational-sheet', authenticateToken, savePumpOperationalSheet);
apiRouter.get('/pumps', getAllPumps);
apiRouter.get('/pumps/:id', getPumpById);
apiRouter.post('/pumps', authenticateToken, createPumpReport);
apiRouter.patch('/pumps/:id/status', authenticateToken, updatePumpStatus);

// 5. Cyclones Routes
apiRouter.get('/cyclones', getAllCyclones);
apiRouter.post('/cyclones', authenticateToken, createCycloneReport);
apiRouter.get('/cyclones/station-samples', getStationSamples);
apiRouter.post('/cyclones/station-samples', authenticateToken, createStationSample);
apiRouter.delete('/cyclones/station-samples/:id', authenticateToken, deleteStationSample);

// 6. Tailings & Dam Routes
apiRouter.get('/tailings', getAllTailings);
apiRouter.post('/tailings', authenticateToken, createTailingsReport);

// 7. Shift Handover Routes
apiRouter.get('/shift-handover', getAllShiftHandovers);
apiRouter.post('/shift-handover', authenticateToken, createShiftHandover);
apiRouter.patch('/shift-handover/:id/accept', authenticateToken, acceptShiftHandover);

// 8. Maintenance Routes
apiRouter.get('/maintenance', getAllMaintenanceRequests);
apiRouter.post('/maintenance', authenticateToken, createMaintenanceRequest);
apiRouter.patch('/maintenance/:id/status', authenticateToken, updateMaintenanceStatus);

// 9. Admin & Backups
apiRouter.get('/admin/users', authenticateToken, requireRoles('ADMIN', 'SUPERVISOR'), getAllUsers);
apiRouter.post('/admin/users', authenticateToken, requireRoles('ADMIN'), createUserByAdmin);
apiRouter.post('/admin/users/bulk', authenticateToken, requireRoles('ADMIN'), createUsersBulk);
apiRouter.get('/admin/audit-logs', authenticateToken, requireRoles('ADMIN'), getAuditLogs);
apiRouter.get('/admin/backup', authenticateToken, requireRoles('ADMIN'), getDatabaseBackup);
apiRouter.post('/admin/restore', authenticateToken, requireRoles('ADMIN'), restoreDatabaseBackup);

// 10. Crew & Area Assignments Routes (Gestión de Cuadrilla y Asignación por Área)
apiRouter.get('/crew/members', getCrewMembers);
apiRouter.post('/crew/members', authenticateToken, createCrewMember);
apiRouter.put('/crew/members/:id', authenticateToken, updateCrewMember);
apiRouter.delete('/crew/members/:id', authenticateToken, deleteCrewMember);
apiRouter.get('/crew/assignments', getAreaAssignments);
apiRouter.post('/crew/assignments', authenticateToken, saveAreaAssignment);
apiRouter.patch('/crew/assignments/:id/checkin', authenticateToken, checkinAreaAssignment);
apiRouter.get('/crew/positions', getCrewPositions);
apiRouter.post('/crew/positions', authenticateToken, createCrewPosition);
apiRouter.delete('/crew/positions/:key', authenticateToken, deleteCrewPosition);

// 11. Cloud Realtime Sync Routes (Sincronización Multi-Dispositivo)
apiRouter.post('/sync/push', pushEvents);
apiRouter.get('/sync/pull', pullEvents);
apiRouter.get('/sync/status', getSyncStatus);
