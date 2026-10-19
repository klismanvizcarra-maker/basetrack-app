import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

export const routes: Routes = [
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      },
      {
        path: 'dashboard',
        data: { permission: 'VIEW_DASHBOARD' },
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'shift-handover',
        data: { permission: 'VIEW_SHIFT_HANDOVER' },
        loadComponent: () => import('./features/shift-handover/shift-handover.component').then(m => m.ShiftHandoverComponent)
      },
      {
        path: 'crew',
        data: { permission: 'VIEW_CREW' },
        loadComponent: () => import('./features/crew/crew-management.component').then(m => m.CrewManagementComponent)
      },
      {
        path: 'pumps',
        data: { permission: 'VIEW_PUMPS' },
        loadComponent: () => import('./features/pumps/pumps.component').then(m => m.PumpsComponent)
      },
      {
        path: 'cyclones',
        data: { permission: 'VIEW_CYCLONES' },
        loadComponent: () => import('./features/cyclones/cyclones.component').then(m => m.CyclonesComponent)
      },
      {
        path: 'tailings',
        data: { permission: 'VIEW_TAILINGS' },
        loadComponent: () => import('./features/tailings/tailings.component').then(m => m.TailingsComponent)
      },
      {
        path: 'flowsheet',
        data: { permission: 'VIEW_FLOWSHEET' },
        loadComponent: () => import('./features/flowsheet/flowsheet.component').then(m => m.FlowsheetComponent)
      },
      {
        path: 'maintenance',
        data: { permission: 'VIEW_MAINTENANCE' },
        loadComponent: () => import('./features/maintenance/maintenance.component').then(m => m.MaintenanceComponent)
      },
      {
        path: 'calculators',
        data: { permission: 'VIEW_CALCULATORS' },
        loadComponent: () => import('./features/calculators/metallurgical-calculators.component').then(m => m.MetallurgicalCalculatorsComponent)
      },
      {
        path: 'vehicle-checklist',
        data: { permission: 'VIEW_VEHICLE_CHECKLIST' },
        loadComponent: () => import('./features/vehicle-checklist/vehicle-checklist.component').then(m => m.VehicleChecklistComponent)
      },
      {
        path: 'roster',
        data: { permission: 'VIEW_ROSTER' },
        loadComponent: () => import('./features/roster/guard-roster.component').then(m => m.GuardRosterComponent)
      },
      {
        path: 'admin',
        data: { permission: 'VIEW_ADMIN', roles: ['ADMIN'] },
        loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
