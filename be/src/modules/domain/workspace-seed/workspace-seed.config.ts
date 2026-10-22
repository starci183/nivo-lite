import { type EnvSource, Secret } from "@modules/platform/config"
import type { WorkspaceSeedOptions } from "./workspace-seed.options"

/** Reads optional private input so unrelated CLI commands can still boot without access credentials. */
export const parseWorkspaceSeedConfig = (
    env: EnvSource,
): Pick<WorkspaceSeedOptions, "input" | "profileInput" | "officeInput"> => {
    const input = env.optional("WORKSPACE_SEED_INPUT")
    const profileInput = env.optional("WORKSPACE_PROFILE_INPUT")
    const officeInput = env.optional("WORKSPACE_OFFICE_INPUT")
    return {
        input: input === undefined ? undefined : new Secret(input),
        profileInput: profileInput === undefined ? undefined : new Secret(profileInput),
        officeInput: officeInput === undefined ? undefined : new Secret(officeInput),
    }
}
