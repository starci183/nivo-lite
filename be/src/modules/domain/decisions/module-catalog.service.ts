import type { ModuleDefinition } from "@modules/domain/modules"
import { Injectable } from "@nestjs/common"
import type { OptionalAuthorityRule } from "@modules/domain/authority-rules"
import type { Locale } from "@modules/platform/i18n"
import type { ModuleCommand, OptionalActionEntry, OptionalModuleEntry } from "./decisions.contracts"
import { toActionEntry, toModuleEntry } from "./module-catalog.mapper"
import { InjectModuleCatalogSource } from "./work-engine.decorators"
import type { ModuleCatalogSource } from "./work-engine.port"

@Injectable()
/** The module registry of the catalogue: what each module accepts and which actions it owns. */
export class ModuleCatalogService {
    constructor(@InjectModuleCatalogSource() private readonly source: ModuleCatalogSource) {}

    /** The module with that key, or null when the registry has none. */
    async entryOf(moduleKey: string): Promise<OptionalModuleEntry> {
        const module = (await this.source.catalog()).modules.find((candidate) => candidate.key === moduleKey)
        return module === undefined ? null : toModuleEntry(module)
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
    async actionOf(action: string): Promise<OptionalActionEntry> {
        const module = await this.performerOf(action)
        const definition = module?.authorityActions.find((candidate) => candidate.action === action)
        return module === undefined || definition === undefined ? null : toActionEntry(module.key, definition)
    }

    /**
     * The rule a tag right stands for when the owner stored none: the action runs alone, asking for the fields the catalogue lists. Null
     * when the registry does not know the action.
     */
    async tagRuleOf(action: string): Promise<OptionalAuthorityRule> {
        const module = await this.performerOf(action)
        const definition = module?.authorityActions.find((candidate) => candidate.action === action)
        if (module === undefined || definition === undefined) return null
        return {
            id: `tag:${action}`,
            department: module.key,
            action,
            mode: "auto",
            limit_vnd: null,
            required_fields: definition.requiredFields,
        }
    }

    /** The module of the catalogue that performs an action, with the definition of that action; undefined when no module lists it. */
    private async performerOf(action: string): Promise<ModuleDefinition | undefined> {
        return (await this.source.catalog()).modules.find((module) =>
            module.authorityActions.some((candidate) => candidate.action === action),
        )
    }
}
