export interface AuthUser {
  userId: string;
  businessId?: string;
  role?: 'OWNER' | 'MANAGER' | 'WORKER' | 'SUPER_ADMIN';
  assignedStore?: string | null;
  email?: string;
  name?: string;
}
