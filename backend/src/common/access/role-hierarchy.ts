import { Role } from '@prisma/client';

/**
 * Company-internal account-management hierarchy: a role may act on any
 * user whose role sits strictly below it, never a peer or someone above.
 * SUPER_ADMIN is unrestricted. This is the one predicate every "can this
 * caller manage/view that user" check in the app should go through.
 */
const TIER: Record<Role, number> = {
  [Role.SUPER_ADMIN]: 0,
  [Role.COMPANY_ADMIN]: 1,
  [Role.BOD]: 2,
  [Role.HR]: 3,
  [Role.EMPLOYEE]: 4,
};

export function canManageRole(callerRole: Role, targetRole: Role): boolean {
  if (callerRole === Role.SUPER_ADMIN) return true;
  return TIER[callerRole] < TIER[targetRole];
}

/** Every role a caller of this role may create/edit/delete/reassign. */
export function getManageableRoles(callerRole: Role): Role[] {
  return (Object.values(Role) as Role[]).filter((role) =>
    canManageRole(callerRole, role),
  );
}

/**
 * Employee-like roles: BOD, HR, and EMPLOYEE all maintain personal records
 * (profile, skills, passport, assessments as participant, AI companion).
 * Only SUPER_ADMIN and COMPANY_ADMIN are pure system-management roles.
 */
export function isEmployeeRole(role: Role): boolean {
  return role !== Role.SUPER_ADMIN && role !== Role.COMPANY_ADMIN;
}
