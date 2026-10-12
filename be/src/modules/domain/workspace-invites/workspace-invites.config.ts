import type { EnvSource } from "@modules/platform/config"
import type { WorkspaceInvitesOptions } from "./workspace-invites.options"

/** Reads the invitation keys; the site origin has no default, the validity does. */
export const parseWorkspaceInvitesConfig = (env: EnvSource): WorkspaceInvitesOptions => ({
    siteUrl: env.url("SITE_URL").replace(/\/$/, ""),
    inviteDays: env.int("INVITE_VALID_DAYS", 7),
})
