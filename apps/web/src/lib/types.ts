// Shapes returned by the NestJS API.

export type Role = 'ADMIN' | 'MANAGER' | 'MEMBER';
export const ROLES: Role[] = ['ADMIN', 'MANAGER', 'MEMBER'];

export type Permission = 'project:read' | 'project:write' | 'project:delete' | 'user:read' | 'user:manage' | 'audit:read';

export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
export const PROJECT_STATUSES: ProjectStatus[] = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'];

export interface Me {
  id: string;
  email: string;
  name: string;
  role: Role;
  orgId: string;
  permissions: Permission[];
  org: { id: string; name: string; slug: string };
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string } | null;
}

export interface OrgUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}

export interface DashboardStats {
  totalProjects: number;
  projectsByStatus: Partial<Record<ProjectStatus, number>>;
  activeUsers: number;
  auditEvents24h: number;
  generatedAt: string;
  cache: 'HIT' | 'MISS';
}
