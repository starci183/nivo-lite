import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ModulesError, ModulesErrorCode } from "./errors/modules.error"
import { InjectModulesOptions } from "./modules.decorators"
import type { ModuleDefinition, ModulesCatalog, ModulesOutput, ModulesSyncReport } from "./modules.contracts"
import type { ModulesOptions } from "./modules.options"
import { ModuleEntity } from "./persistence/entities"
import { checkCatalog } from "./policies/catalog.policy"

/** How many module rows are read back at once. */
const MODULES_LIMIT = 500

const toModuleRecord = (module: ModuleDefinition) => ({
    key: module.key,
    sortOrder: module.order,
    status: module.status,
    category: module.category,
    audience: module.audience,
    knowledgeFolder: module.knowledgeFolder,
    workbench: module.workbench,
    defaultOperatingMode: module.defaultOperatingMode,
    multiInstance: module.multiInstance,
    definition: module,
})

@Injectable()
/** The catalogue of installable agents, served from the typed options, and its mirror in the public.modules tables. */
export class ModulesService {
    constructor(
        @InjectModulesOptions() private readonly options: ModulesOptions,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    ) {}

    /** The whole catalogue: categories and modules in display order. */
    catalog(): Promise<ModulesCatalog> {
        return Promise.resolve({ categories: this.options.categories, modules: this.options.catalog })
    }

    /** One module of the catalogue by key; an unknown key is a typed not-found result. */
    find(key: string): Promise<ModuleDefinition> {
        const found = this.options.catalog.find((module) => module.key === key)
        return found === undefined
            ? Promise.reject(new ModulesError({ code: ModulesErrorCode.NotFound, params: { key } }))
            : Promise.resolve(found)
    }

    /**
     * Mirrors the catalogue into public.modules in one transaction (upsert by key). Nothing is deleted: a module still referenced by a
     * workspace must not disappear, so the rows the catalogue no longer lists are only reported. No authority action is mirrored: the
     * authority rules are gone (2026-11-13).
     */
    sync(): Promise<ModulesSyncReport> {
        const problems = checkCatalog(this.options.catalog, this.options.categories)
        if (problems.length > 0) {
            return Promise.reject(
                new ModulesError({ code: ModulesErrorCode.CatalogInvalid, params: { problems: problems.join("; ") } }),
            )
        }
        const modules = this.options.catalog.map((module) => toModuleRecord(module))
        return this.entityManager.transaction(async (tx) => {
            const upserted = await tx.upsert(ModuleEntity, modules, ["key"])
            const written = upserted.identifiers.map((identifier) => ({ key: String(identifier.key) }))
            const held = await tx.find(ModuleEntity, {
                select: { key: true },
                order: { key: "ASC" },
                take: MODULES_LIMIT,
            })
            const keys = new Set(written.map((row) => row.key))
            return {
                modules: written.length,
                staleModules: held.map((row) => row.key).filter((key) => !keys.has(key)),
            }
        })
    }

    /** Syncs the catalogue and prints `catalogue ok <modules>`: the deploy runs this so the module rows follow the code. */
    async ensure(output: ModulesOutput): Promise<void> {
        const report = await this.sync()
        output.write(`catalogue ok ${report.modules}\n`)
    }
}
