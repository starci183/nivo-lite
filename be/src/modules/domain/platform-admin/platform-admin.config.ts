import type { EnvSource } from "@modules/platform/config"
import type { PlatformAdminOptions } from "./platform-admin.options"

/** Reads the platform team's emails from the comma list `NIVO_PLATFORM_ADMINS`; absent means nobody is an admin. */
export const parsePlatformAdminConfig = (env: EnvSource): PlatformAdminOptions => ({
    admins: (env.optional("NIVO_PLATFORM_ADMINS") ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email !== ""),
})
