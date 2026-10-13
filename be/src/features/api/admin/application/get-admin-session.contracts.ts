import type { AdminIdentity } from "@modules/domain/platform-admin"

/** What getAdminSession takes. */
export type GetAdminSessionRequest = Readonly<Record<string, never>>

/** What getAdminSession answers. */
export type GetAdminSessionResult = Readonly<AdminIdentity>
