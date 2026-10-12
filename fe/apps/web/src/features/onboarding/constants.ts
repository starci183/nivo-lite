/** Business types offered at onboarding (stored as `workspaces.business_type`). */
export const BUSINESS_TYPES = ["retail", "services", "clinic", "education", "other"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];
