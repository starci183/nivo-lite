import type { AdminHealth } from "@modules/domain/platform-admin"

/** What getPlatformHealth takes. */
export type GetPlatformHealthRequest = Readonly<Record<string, never>>

/** What getPlatformHealth answers. */
export type GetPlatformHealthResult = Readonly<AdminHealth>
