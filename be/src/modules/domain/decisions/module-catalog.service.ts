import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { Locale } from "@modules/platform/i18n"
import type { ModuleCommand, OptionalActionEntry, OptionalModuleEntry } from "./decisions.contracts"
import { toActionEntry, toModuleEntry } from "./module-catalog.mapper"
import type { ActionRow, ModuleRow } from "./persistence/module-catalog.rows"
import { FIND_ACTION, FIND_MODULE } from "./persistence/module-catalog.sql"

@Injectable()
/** The module registry as the database holds it: what each module accepts and which actions it owns. */
export class ModuleCatalogService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The module with that key, or null when the registry has none. */
    async entryOf(moduleKey: string, manager: EntityManager = this.entityManager): Promise<OptionalModuleEntry> {
        const row = (await manager.query<Array<ModuleRow>>(FIND_MODULE, [moduleKey]))[0]
        return row === undefined ? null : toModuleEntry(row)
    }

    /** The commands the module accepts from other agents; none for an unknown module. */
    async acceptsOf(moduleKey: string): Promise<ReadonlyArray<ModuleCommand>> {
        return (await this.entryOf(moduleKey))?.accepts ?? []
    }

    /** The module's full name in the language; the key itself when the module or its name is unknown. */
    async nameOf(moduleKey: string, locale: Locale, manager: EntityManager = this.entityManager): Promise<string> {
        const name = (await this.entryOf(moduleKey, manager))?.name[locale] ?? ""
        return name === "" ? moduleKey : name
    }

    /** The authority action with that key, or null when the registry has none. */
    async actionOf(action: string, manager: EntityManager = this.entityManager): Promise<OptionalActionEntry> {
        const row = (await manager.query<Array<ActionRow>>(FIND_ACTION, [action]))[0]
        return row === undefined ? null : toActionEntry(row)
    }
}
