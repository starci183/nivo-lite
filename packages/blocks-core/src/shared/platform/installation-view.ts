import type { InstallationFacts, InstallationView } from "./platform.types"

/** The installation a screen reads: every module of the registry, marked enabled when the workspace has it enabled. */
export const installationViewOf = (facts: InstallationFacts): InstallationView => {
    const enabled = new Set(facts.enabled)
    return {
        registryHash: facts.registryHash,
        modules: facts.modules.map((module) => ({ ...module, enabled: enabled.has(module.key) })),
    }
}
