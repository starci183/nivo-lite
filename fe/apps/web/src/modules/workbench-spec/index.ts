import { installed } from "@/modules/plugin-registry"
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
    installed.modules.find((declaration) => declaration.key === module) ?? null

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

/** The id prefix of the views of a spec that are data pages: the view `data-<set>` is the page of the set `<set>`. */
const DATA_VIEW_PREFIX = "data-"

/** The one view of a data page: the spec cut to it, which is the whole page. */
interface DataView {
    /** The id of the view, which the spec host opens. */
    readonly id: string
    /** The spec holding only that view (no head, foot or aside of the module, no tab count or command), drawn as a visible view. */
    readonly spec: StoredSpec
}

/**
 * The data page of a set in a module's spec: its view `data-<set>`, cut out so the page draws that view alone, with the params the
 * spec declares (a search, the chosen row). Null when the spec ships no such view: the set key comes from the address, so no list of sets
 * is written in the web.
 */
export const dataViewOf = (spec: StoredSpec, set: string): DataView | null => {
    const id = `${DATA_VIEW_PREFIX}${set}`
    const view = spec.views.find((candidate) => candidate.id === id)
    if (view === undefined) return null
    return {
        id,
        spec: {
            schema: spec.schema,
            module: spec.module,
            ...(spec.params === undefined ? {} : { params: spec.params }),
            views: [{ id: view.id, label: view.label, root: view.root, ...(view.command === undefined ? {} : { command: view.command }) }],
        },
    }
}
