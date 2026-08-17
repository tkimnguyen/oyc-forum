export const ROLE_RANK: Record<string, number> = {
  guest: 0,
  member: 1,
  moderator: 2,
  board: 3,
  admin: 4,
};

export function roleRank(role: string | null | undefined): number {
  return ROLE_RANK[role ?? "guest"] ?? 0;
}

export function canAccessCategory(
  userRole: string | null | undefined,
  minimumRole: string | null | undefined
): boolean {
  return roleRank(userRole) >= roleRank(minimumRole ?? "member");
}
