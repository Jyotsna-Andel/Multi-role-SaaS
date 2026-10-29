import { Role } from '@prisma/client';

export const Permission = {
  PROJECT_READ: 'project:read',
  PROJECT_WRITE: 'project:write',
  PROJECT_DELETE: 'project:delete',
  USER_READ: 'user:read',
  USER_MANAGE: 'user:manage',
  AUDIT_READ: 'audit:read',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

/** Single source of truth for what each role may do. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: Object.values(Permission),
  MANAGER: [Permission.PROJECT_READ, Permission.PROJECT_WRITE, Permission.USER_READ],
  MEMBER: [Permission.PROJECT_READ],
};

export function hasPermissions(role: Role, required: readonly Permission[]): boolean {
  const granted = ROLE_PERMISSIONS[role];
  return required.every((p) => granted.includes(p));
}
