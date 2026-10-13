import type { ModuleCategory, ModuleDefinition } from "./modules.contracts"

/** Options of the modules capability: the catalogue the app root registers. */
export interface ModulesOptions {
    /** The categories the catalogue groups modules by, in display order. */
    readonly categories: ReadonlyArray<ModuleCategory>
    /** The modules of the catalogue. */
    readonly catalog: ReadonlyArray<ModuleDefinition>
    /** Only the catalogue and its mirror in the database (the cli seed): none of the installed-agent lifecycle. */
    readonly catalogOnly?: boolean
}
