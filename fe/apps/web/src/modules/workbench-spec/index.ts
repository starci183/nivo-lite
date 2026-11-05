import { MODULE_DECLARATIONS } from "@nivo-lite/blocks-core/modules"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import type { StoredSpec } from "@nivo-lite/agent-sdk/spec"

/** The spec a workbench route draws for one module, and the seeded default it falls back to when the spec no longer fits the blocks. */
interface WorkbenchSpecResult {
    /** The module whose workbench it is. */
    readonly declaration: ModuleDeclaration
    /** The spec to draw: the published version when there is one, else the seed. */
    readonly spec: StoredSpec
    /** The seed spec of the module; null when the spec drawn is the seed itself. */
    readonly fallback: StoredSpec | null
}

/** The module a route names, by key; null for a module that is not declared. */
export const declarationOf = (module: string): ModuleDeclaration | null =>
    MODULE_DECLARATIONS.find((declaration) => declaration.key === module) ?? null

/**
 * The spec of a module's workbench. The published, versioned spec read through the door is the first choice; the door does not
 * serve one yet, so this answers the seed spec of the module's declaration. A module that is not declared, or declares no spec, has
 * no workbench (null).
 */
export const workbenchSpec = (module: string): WorkbenchSpecResult | null => {
    const declaration = declarationOf(module)
    const seed = declaration?.specs[0]
    if (declaration === null || seed === undefined) return null
    return { declaration, spec: seed, fallback: null }
}
