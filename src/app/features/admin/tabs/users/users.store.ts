import { Injectable, signal } from '@angular/core';

export interface UserItem {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'MAINTENANCE';
  shift: string;
  avatar_url: string;
  created_at: string;
  is_active?: number | boolean;
  document_id?: string;
}

/**
 * Cuentas de usuario compartidas entre Administración (contador y carga), la pestaña
 * Usuarios y la Matriz de Permisos (excepciones por usuario).
 */
@Injectable({ providedIn: 'root' })
export class UsersStore {
  private usersSignal = signal<UserItem[]>([]);
  get users(): UserItem[] { return this.usersSignal(); }
  set users(list: UserItem[]) { this.usersSignal.set(list); }
}
