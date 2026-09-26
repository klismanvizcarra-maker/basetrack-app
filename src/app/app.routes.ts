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
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'shift-handover',
        loadComponent: () => import('./features/shift-handover/shift-handover.component').then(m => m.ShiftHandoverComponent)
      },
      {
        path: 'crew',
        loadComponent: () => import('./features/crew/crew-management.component').then(m => m.CrewManagementComponent)
      },
      {
        path: 'pumps',
        loadComponent: () => import('./features/pumps/pumps.component').then(m => m.PumpsComponent)
      },
      {
        path: 'cyclones',
        loadComponent: () => import('./features/cyclones/cyclones.component').then(m => m.CyclonesComponent)
      },
      {
        path: 'tailings',
        loadComponent: () => import('./features/tailings/tailings.component').then(m => m.TailingsComponent)
      },
      {
        path: 'maintenance',
        loadComponent: () => import('./features/maintenance/maintenance.component').then(m => m.MaintenanceComponent)
      },
      {
        path: 'calculators',
        loadComponent: () => import('./features/calculators/metallurgical-calculators.component').then(m => m.MetallurgicalCalculatorsComponent)
      },
      {
        path: 'vehicle-checklist',
        loadComponent: () => import('./features/vehicle-checklist/vehicle-checklist.component').then(m => m.VehicleChecklistComponent)
      },
      {
        path: 'admin',
        canActivate: [authGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent)
      },
      {
        path: 'profile',
        canActivate: [authGuard],
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
