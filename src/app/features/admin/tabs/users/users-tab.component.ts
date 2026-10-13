import { Component, Output, EventEmitter, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { getApiBaseUrl } from '../../../../core/constants/api.config';
import { getRealtimeData, saveRealtimeData } from '../../../../core/storage/local-store.util';
import { ModalComponent } from '../../../../shared/ui/modal.component';
import { UsersStore, UserItem } from './users.store';

export interface IssuedCredential { username: string; full_name: string; temporaryPassword: string; }

/**
 * Pestaña "Usuarios & Cuentas" de Administración: filtros, edición de rol/guardia,
 * restablecimiento de contraseña y suspensión. Estilos en admin.component.scss (.admin-scope).
 */
@Component({
  selector: 'app-admin-users-tab',
  // Muta estado en callbacks HTTP: requiere revisión en cada ciclo (Angular 22 usa OnPush por defecto)
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './users-tab.component.html',
  host: { style: 'display: contents' }
})
export class AdminUsersTabComponent {
  /** Mensajes para el aviso general de Administración */
  @Output() notify = new EventEmitter<{ text: string; ms: number }>();
  /** Contraseñas temporales emitidas: las muestra (una sola vez) el modal del padre */
  @Output() issuedCredentials = new EventEmitter<IssuedCredential[]>();

  private http = inject(HttpClient);
  private usersStore = inject(UsersStore);

  get users(): UserItem[] { return this.usersStore.users; }
  set users(list: UserItem[]) { this.usersStore.users = list; }

  private showIssuedCredentials(list: IssuedCredential[]): void {
    this.issuedCredentials.emit(list);
  }

  // Toolbar & Search Filters (Punto 1)
  userSearchQuery = '';
  userFilterShift = 'TODAS';
  userFilterRole = 'TODOS';

  // Modal: Edit User Role & Shift (Punto 1)
  isEditUserModalOpen = false;
  selectedUserForEdit: UserItem | null = null;
  editRole: 'ADMIN' | 'SUPERVISOR' | 'OPERATOR' = 'OPERATOR';
  editShift = 'G1';
  isSavingUser = false;

  // Modal: Reset Password (Punto 1)
  isResetPasswordModalOpen = false;
  selectedUserForReset: UserItem | null = null;
  resetNewPassword = '';

  get filteredUsers(): UserItem[] {
    return this.users.filter(u => {
      // Shift filter
      if (this.userFilterShift !== 'TODAS' && u.shift !== this.userFilterShift) {
        return false;
      }
      // Role filter
      if (this.userFilterRole !== 'TODOS' && u.role !== this.userFilterRole) {
        return false;
      }
      // Search query
      if (this.userSearchQuery.trim()) {
        const q = this.userSearchQuery.toLowerCase().trim();
        const username = (u.username || '').toLowerCase();
        const fullName = (u.full_name || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        return username.includes(q) || fullName.includes(q) || email.includes(q);
      }
      return true;
    });
  }

  // ==========================================
  // PUNTO 1: GESTIÓN DE USUARIOS Y ACCIONES
  // ==========================================

  openEditUserModal(u: UserItem): void {
    this.selectedUserForEdit = u;
    this.editRole = u.role;
    this.editShift = u.shift;
    this.isEditUserModalOpen = true;
  }

  saveUserRoleShift(): void {
    if (!this.selectedUserForEdit) return;
    this.isSavingUser = true;
    const user = this.selectedUserForEdit;
    const newRole = this.editRole;
    const newShift = this.editShift;

    this.http.patch<any>(`${getApiBaseUrl()}/admin/users/${user.id}/role-shift`, {
      role: newRole,
      shift: newShift
    }).subscribe({
      next: () => {
        this.isSavingUser = false;
        user.role = newRole;
        user.shift = newShift;
        this.syncUserToLocalAndCrew(user);
        this.isEditUserModalOpen = false;
        this.notify.emit({ text: `Rol (${newRole}) y Turno (${newShift}) actualizados para ${user.username}. Sincronizado con Cuadrilla.`, ms: 5000 });
      },
      error: (err) => {
        this.isSavingUser = false;
        console.warn('[Admin] Backend inaccesible o error, aplicando actualización localmente:', err);
        user.role = newRole;
        user.shift = newShift;
        this.syncUserToLocalAndCrew(user);
        this.isEditUserModalOpen = false;
        this.notify.emit({ text: `Rol y Turno actualizados para ${user.username}.`, ms: 5000 });
      }
    });
  }

  openResetPasswordModal(u: UserItem): void {
    this.selectedUserForReset = u;
    this.resetNewPassword = '';
    this.isResetPasswordModalOpen = true;
  }

  confirmResetPassword(): void {
    if (!this.selectedUserForReset) return;
    this.isSavingUser = true;
    const user = this.selectedUserForReset;

    this.http.post<any>(`${getApiBaseUrl()}/admin/users/${user.id}/reset-password`, {
      newPassword: this.resetNewPassword.trim() || undefined
    }).subscribe({
      next: (res) => {
        this.isSavingUser = false;
        this.isResetPasswordModalOpen = false;
        this.notify.emit({ text: res?.message || `Contraseña restablecida con éxito para ${user.username}.`, ms: 6000 });
        if (res?.temporaryPassword) {
          this.showIssuedCredentials([{ username: user.username, full_name: user.full_name, temporaryPassword: res.temporaryPassword }]);
        }
      },
      error: (err) => {
        this.isSavingUser = false;
        this.isResetPasswordModalOpen = false;
        console.warn('[Admin] Error restableciendo contraseña en servidor:', err);

        // La contraseña solo existe en el servidor: si este falla, no se restableció
        alert(`No se pudo restablecer la contraseña de ${user.username}: ${err?.error?.message || 'el servidor no respondió'}.`);
      }
    });
  }

  toggleUserStatus(u: UserItem): void {
    if (u.username === 'Marckv') {
      alert('La cuenta de Administrador Principal no puede ser desactivada.');
      return;
    }

    const currentStatus = u.is_active !== 0;
    const newStatus = !currentStatus;
    const actionName = newStatus ? 'activar' : 'suspender';

    if (!confirm(`¿Estás seguro de ${actionName} el acceso al sistema para ${u.username}?`)) {
      return;
    }

    this.http.patch<any>(`${getApiBaseUrl()}/admin/users/${u.id}/status`, {
      isActive: newStatus
    }).subscribe({
      next: () => {
        u.is_active = newStatus ? 1 : 0;
        this.saveUsersToStorage();
        this.notify.emit({ text: `Usuario ${u.username} ${newStatus ? 'activado' : 'suspendido'} exitosamente.`, ms: 5000 });
      },
      error: (err) => {
        console.warn('[Admin] Error en servidor, actualizando estado local:', err);
        u.is_active = newStatus ? 1 : 0;
        this.saveUsersToStorage();
        this.notify.emit({ text: `Estado de ${u.username} actualizado (${newStatus ? 'Activo' : 'Suspendido'}).`, ms: 5000 });
      }
    });
  }

  private syncUserToLocalAndCrew(user: UserItem): void {
    this.saveUsersToStorage();

    // Sincronizar con cuadrilla localmente
    try {
      const storedCrew = localStorage.getItem('basetrack_crew_members');
      if (storedCrew) {
        const crewList = JSON.parse(storedCrew);
        const member = crewList.find((c: any) => c.name === user.full_name || (user.document_id && c.document_id === user.document_id));
        if (member) {
          member.shift_code = user.shift;
          if (user.role === 'SUPERVISOR') member.primary_role = 'SUPERVISOR';
          saveRealtimeData('crew_members', crewList);
        }
      }
    } catch (e) {
      console.warn('Error sincronizando con cuadrilla:', e);
    }
  }

  private saveUsersToStorage(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('basetrack_admin_users', JSON.stringify(this.users));
    }
  }
}
