import { Injectable } from "@nestjs/common"
import { MODULE_CATALOG } from "@modules/domain/modules"
import type { ModuleDefinition } from "@modules/domain/modules"
import type { Locale } from "@modules/platform/i18n"
import type { ModuleCommand, OptionalActionEntry, OptionalModuleEntry } from "./decisions.contracts"
import { toActionEntry, toModuleEntry } from "./module-catalog.mapper"

/** The module of the catalogue that performs an action, with the definition of that action; null when no module lists it. */
const performerOf = (action: string): ModuleDefinition | undefined =>
    MODULE_CATALOG.find((module) => module.authorityActions.some((candidate) => candidate.action === action))

@Injectable()
/** The module registry of the catalogue: what each module accepts and which actions it owns. */
export class ModuleCatalogService {
    /** The module with that key, or null when the registry has none. */
    entryOf(moduleKey: string): Promise<OptionalModuleEntry> {
        const module = MODULE_CATALOG.find((candidate) => candidate.key === moduleKey)
        return Promise.resolve(module === undefined ? null : toModuleEntry(module))
    }

    /** The commands the module accepts from other agents; none for an unknown module. */
    async acceptsOf(moduleKey: string): Promise<ReadonlyArray<ModuleCommand>> {
        return (await this.entryOf(moduleKey))?.accepts ?? []
    }

    /** The module's full name in the language; the key itself when the module or its name is unknown. */
    async nameOf(moduleKey: string, locale: Locale): Promise<string> {
        const name = (await this.entryOf(moduleKey))?.name[locale] ?? ""
        return name === "" ? moduleKey : name
    }

    /** The authority action with that key, or null when the registry has none. */
    actionOf(action: string): Promise<OptionalActionEntry> {
        const module = performerOf(action)
        const definition = module?.authorityActions.find((candidate) => candidate.action === action)
        return Promise.resolve(
            module === undefined || definition === undefined ? null : toActionEntry(module.key, definition),
        )
    }
}
