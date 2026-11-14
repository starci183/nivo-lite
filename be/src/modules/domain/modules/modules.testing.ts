import { ModulesError, ModulesErrorCode } from "./errors/modules.error"
import type { ModuleDefinition } from "./modules.contracts"
import { MODULE_CATALOG } from "./modules.catalog.contracts"

/**
 * Spec support (never imported by production): the catalogue definition of a module key, read from the one source production reads
 * it from (the installation's catalogue templates); a spec that names a key the catalogue lacks fails here, with the key.
 */
export const catalogModuleOf = (key: string): ModuleDefinition => {
    const module = MODULE_CATALOG.find((candidate) => candidate.key === key)
    if (module === undefined) throw new ModulesError({ code: ModulesErrorCode.NotFound, params: { key } })
    return module
}
