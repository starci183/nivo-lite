import type { EnvSource } from "@modules/platform/config"
import type { WorkspacesOptions } from "./workspaces.options"

/**
 * Reads the workspaces keys; free signup is off unless the environment says otherwise. `NIVO_ALLOW_WORKSPACE_SIGNUP=1` is the switch
 * local and demo environments already set for the old web app, so it turns free signup on too.
 */
export const parseWorkspacesConfig = (env: EnvSource): WorkspacesOptions => ({
    allowFreeWorkspace:
        env.bool("WORKSPACE_SIGNUP_ENABLED", false) || env.optional("NIVO_ALLOW_WORKSPACE_SIGNUP") === "1",
})
