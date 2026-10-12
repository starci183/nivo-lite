import type { EnvSource } from "@modules/platform/config"
import type { WorkspacesOptions } from "./workspaces.options"

/** Reads the workspaces keys; free signup is off unless the environment says otherwise. */
export const parseWorkspacesConfig = (env: EnvSource): WorkspacesOptions => ({
    allowFreeWorkspace: env.bool("WORKSPACE_SIGNUP_ENABLED", false),
})
