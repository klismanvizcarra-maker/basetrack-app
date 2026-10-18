import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PermissionsService, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, PermissionKey, PermissionDefinition } from '../../../../core/auth/permissions.service';
import { UsersStore, UserItem } from '../users/users.store';
import { getEffectiveAvatar } from '../../../../shared/utils/avatar.util';

/**
 * Pestaña "Matriz de Permisos" de Administración: RBAC por rol y excepciones por usuario.
 * Estilos en admin.component.scss (.admin-scope).
 */
@Component({
  selector: 'app-admin-permissions-tab',
  // Muta estado en callbacks HTTP: requiere revisión en cada ciclo (Angular 22 usa OnPush por defecto)
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './permissions-tab.component.html',
  host: { style: 'display: contents' }
})
export class AdminPermissionsTabComponent {
  permissionsService = inject(PermissionsService);
  private usersStore = inject(UsersStore);

  getUserAvatar(user: UserItem): string {
    return getEffectiveAvatar(user?.avatar_url, user?.full_name || user?.username, user?.role, user?.shift);
  }

  get users(): UserItem[] { return this.usersStore.users; }

  // Matriz de Permisos & Seguridad
  allPermissionsList = ALL_PERMISSIONS;
  selectedOverrideUserId = '';
  permissionsSaveMessage = '';
  permFilterCategory: 'ALL' | 'OPERACIONES' | 'GESTIÓN' | 'SEGURIDAD' = 'ALL';
  permSearchQuery = '';

  get filteredPermissionsList(): PermissionDefinition[] {
    return this.allPermissionsList.filter(p => {
      const matchesCat = this.permFilterCategory === 'ALL' || p.category === this.permFilterCategory;
      const q = (this.permSearchQuery || '').trim().toLowerCase();
      const matchesQuery = !q || p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }

  getRolePermCount(role: 'ADMIN' | 'SUPERVISOR' | 'OPERATOR'): number {
    if (role === 'ADMIN') return this.allPermissionsList.length;
    const rolePerms = this.permissionsService.rolePermissionsSignal()[role] || DEFAULT_ROLE_PERMISSIONS[role] || [];
    return rolePerms.length;
  }

  isRolePermitted(role: 'ADMIN' | 'SUPERVISOR' | 'OPERATOR', key: PermissionKey): boolean {
    if (role === 'ADMIN') return true;
    const rolePerms = this.permissionsService.rolePermissionsSignal()[role] || DEFAULT_ROLE_PERMISSIONS[role] || [];
    return rolePerms.includes(key);
  }

  toggleRolePermDirect(role: 'SUPERVISOR' | 'OPERATOR', key: PermissionKey): void {
    const current = [...(this.permissionsService.rolePermissionsSignal()[role] || DEFAULT_ROLE_PERMISSIONS[role] || [])];
    const isCurrentlyPermitted = current.includes(key);
    let updated: PermissionKey[];
    if (isCurrentlyPermitted) {
      updated = current.filter(k => k !== key);
    } else {
      updated = Array.from(new Set([...current, key]));
    }
    this.permissionsService.updateRolePermission(role, updated).subscribe({ error: (err) => this.showPermissionsError(err) });
  }

  setAllPermsForRole(role: 'SUPERVISOR' | 'OPERATOR', enable: boolean): void {
    const allKeys = this.allPermissionsList.map(p => p.key);
    const updated = enable ? allKeys : [];
    this.permissionsService.updateRolePermission(role, updated).subscribe({
      next: () => {
        this.permissionsSaveMessage = `Permisos para ${role} actualizados (${enable ? 'Todos Habilitados' : 'Todos Restringidos'}).`;
        setTimeout(() => this.permissionsSaveMessage = '', 3500);
      },
      error: (err) => this.showPermissionsError(err)
    });
  }

  saveRolePermissionsMatrix(): void {
    this.permissionsSaveMessage = 'Matriz de permisos por rol guardada y sincronizada correctamente.';
    setTimeout(() => this.permissionsSaveMessage = '', 4000);
  }

  resetPermissionsToDefault(): void {
    if (confirm('¿Confirma restaurar la matriz de permisos y excepciones a los valores de fábrica?')) {
      this.permissionsService.resetToDefaults().subscribe({
        next: () => {
          this.permissionsSaveMessage = 'Matriz restaurada a valores por defecto de fábrica.';
          setTimeout(() => this.permissionsSaveMessage = '', 4000);
        },
        error: (err) => this.showPermissionsError(err)
      });
    }
  }

  get selectedOverrideUser(): UserItem | null {
    if (!this.selectedOverrideUserId) return null;
    return this.users.find(u => u.id === this.selectedOverrideUserId) || null;
  }

  isEffectiveUserPermitted(user: UserItem, key: PermissionKey): boolean {
    if (user.role === 'ADMIN') return true;
    const overrides = this.permissionsService.userOverridesSignal()[user.id];
    if (overrides && typeof overrides[key] === 'boolean') {
      return overrides[key];
    }
    return this.isRolePermitted(user.role as any, key);
  }

  isOverridden(userId: string, key: PermissionKey): boolean {
    const overrides = this.permissionsService.userOverridesSignal()[userId];
    return !!overrides && typeof overrides[key] === 'boolean';
  }

  isInheritedFromRole(role: string, key: PermissionKey): boolean {
    return this.isRolePermitted(role as any, key);
  }

  toggleUserOverride(userId: string, key: PermissionKey, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const currentOverrides = { ...(this.permissionsService.userOverridesSignal()[userId] || {}) };
    currentOverrides[key] = checkbox.checked;
    this.permissionsService.updateUserOverride(userId, currentOverrides).subscribe({
      next: () => {
        this.permissionsSaveMessage = 'Excepción de permiso guardada para el usuario.';
        setTimeout(() => this.permissionsSaveMessage = '', 3500);
      },
      error: (err) => this.showPermissionsError(err)
    });
  }

  clearUserOverrides(userId: string): void {
    this.permissionsService.updateUserOverride(userId, {}).subscribe({
      next: () => {
        this.permissionsSaveMessage = 'Excepciones removidas; el usuario hereda los permisos de su rol.';
        setTimeout(() => this.permissionsSaveMessage = '', 3500);
      },
      error: (err) => this.showPermissionsError(err)
    });
  }

  hasCustomOverrides(userId: string): boolean {
    const overrides = this.permissionsService.userOverridesSignal()[userId];
    return !!overrides && Object.keys(overrides).length > 0;
  }

  private showPermissionsError(err: any): void {
    this.permissionsSaveMessage = `⚠️ ${err?.message || 'El servidor rechazó el cambio de permisos.'}`;
    setTimeout(() => this.permissionsSaveMessage = '', 6000);
  }
}
