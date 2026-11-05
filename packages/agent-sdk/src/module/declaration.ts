import type { BlockDefinition } from "../block/block.types"
import { SdkDefinitionError } from "../block/definition-error"
import { specProblems } from "../spec/spec"
import type { ModuleDeclaration, ModuleDeclarationConfig, SeedSpecProblem } from "./declaration.types"

/** Refuses an id that does not start with the module key. */
const assertOwn = (key: string, id: string): void => {
    if (!id.startsWith(`${key}.`)) throw new SdkDefinitionError("MODULE_ID_OUTSIDE", id)
}

/** Refuses a permission the module does not declare. */
const assertDeclared = (permissions: ReadonlyArray<string>, permission: string, at: string): void => {
    if (!permissions.includes(permission)) throw new SdkDefinitionError("MODULE_PERMISSION_UNDECLARED", at)
}

/**
 * Defines a module declaration: its reads, actions, permissions, tools and seed specs, checked as far as the module alone allows.
 * Throws `SdkDefinitionError` at module load when a read or action id does not start with `<key>.` (`MODULE_ID_OUTSIDE`), a
 * read or action needs a permission the module does not declare (`MODULE_PERMISSION_UNDECLARED`), an action `refreshes` a read the
 * module does not have (`MODULE_REFRESH_UNKNOWN`), or a counts read names a list or a filter the module does not have
 * (`MODULE_COUNTS_UNKNOWN`). The seed specs need the installed blocks, so they are judged apart, by `seedSpecProblems`.
 */
export const defineModule = (config: ModuleDeclarationConfig): ModuleDeclaration => {
    const readIds = new Set(config.reads.map((read) => read.id))
    for (const read of config.reads) {
        assertOwn(config.key, read.id)
        assertDeclared(config.permissions, read.permission, read.id)
        const listing = read.listing
        if (listing?.kind === "counts") {
            const list = config.reads.find((candidate) => candidate.id === listing.of)?.listing
            const filters = list?.kind === "list" ? Object.keys(list.shape.filters ?? {}) : []
            if (!filters.includes(listing.by)) throw new SdkDefinitionError("MODULE_COUNTS_UNKNOWN", read.id)
        }
    }
    for (const action of config.actions) {
        assertOwn(config.key, action.id)
        assertDeclared(config.permissions, action.permission, action.id)
        for (const refreshed of action.refreshes ?? [])
            if (!readIds.has(refreshed)) throw new SdkDefinitionError("MODULE_REFRESH_UNKNOWN", action.id)
    }
    return { ...config, entry: "module" }
}

/**
 * What is wrong with the seed specs of a module against the installed blocks and the module's own reads, actions and permissions:
 * every `specProblems` finding, with the index of the spec it is in. Empty when every seed spec may be stored and drawn. A separate
 * function, not a check of `defineModule`, so a module declaration never imports the blocks that draw it.
 */
export const seedSpecProblems = (
    declaration: ModuleDeclaration,
    blocks: ReadonlyArray<BlockDefinition>,
): ReadonlyArray<SeedSpecProblem> =>
    declaration.specs.flatMap((spec, index) =>
        specProblems(spec, blocks, {
            reads: declaration.reads,
            actions: declaration.actions,
            permissions: declaration.permissions,
        }).map((problem): SeedSpecProblem => ({ spec: index, problem })),
    )
