import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import type { InstallationFacts } from "@nivo-lite/blocks-core/modules"

/** The facts of the installation the `platform.installation` read describes: what the modules declare, the registry hash, and the keys the workspace enabled. */
export const installationFactsOf = (
    modules: ReadonlyArray<ModuleDeclaration>,
    registryHash: string,
    enabled: ReadonlyArray<string>,
): InstallationFacts => ({
    registryHash,
    modules: modules.map((module) => ({
        key: module.key,
        permissions: module.permissions,
        reads: module.reads.map((read) => read.id),
        actions: module.actions.map((action) => action.id),
        views: module.specs.flatMap((spec) => spec.views.map((view) => view.id)),
    })),
    enabled,
})
