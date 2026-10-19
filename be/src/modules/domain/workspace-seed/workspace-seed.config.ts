import type { EnvSource } from "@modules/platform/config"
import type { WorkspaceSeedOptions } from "./workspace-seed.options"

/** Reads optional private input so unrelated CLI commands can still boot without access credentials. */
export const parseWorkspaceSeedConfig = (env: EnvSource): Pick<WorkspaceSeedOptions, "input"> => ({
    input: env.has("WORKSPACE_SEED_INPUT") ? env.secret("WORKSPACE_SEED_INPUT") : undefined,
})
