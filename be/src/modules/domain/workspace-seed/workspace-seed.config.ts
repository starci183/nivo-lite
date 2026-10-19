import { type EnvSource, Secret } from "@modules/platform/config"
import type { WorkspaceSeedOptions } from "./workspace-seed.options"

/** Reads optional private input so unrelated CLI commands can still boot without access credentials. */
export const parseWorkspaceSeedConfig = (env: EnvSource): Pick<WorkspaceSeedOptions, "input"> => {
    const input = env.optional("WORKSPACE_SEED_INPUT")
    return { input: input === undefined ? undefined : new Secret(input) }
}
