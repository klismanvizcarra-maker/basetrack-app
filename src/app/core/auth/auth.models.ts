export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'OPERATOR';
export type ShiftCode = 'GUARDIA_A' | 'GUARDIA_B' | 'GUARDIA_C';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  shift: ShiftCode;
  avatarUrl?: string;
  document_id?: string;
  radio_channel?: string;
  phone_extension?: string;
  primary_role?: string;
  password?: string;
  createdAt?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  shift: ShiftCode;
}
