import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AuthorityActionsService } from "@modules/domain/authority-actions"
import type { AuthorityActionRecord } from "@modules/domain/authority-actions"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ModulesError, ModulesErrorCode } from "./errors/modules.error"
import { InjectModulesOptions } from "./modules.decorators"
import type { ModuleDefinition, ModulesCatalog, ModulesSyncReport } from "./modules.contracts"
import type { ModulesOptions } from "./modules.options"
import type { ModulesRow } from "./persistence/modules.rows"
import { LIST_MODULE_KEYS, UPSERT_MODULES } from "./persistence/modules.sql"
import { checkCatalog } from "./policies/catalog.policy"

const toModuleRecord = (module: ModuleDefinition) => ({
    key: module.key,
    sort_order: module.order,
    status: module.status,
    category: module.category,
    audience: module.audience,
    knowledge_folder: module.knowledgeFolder,
    workbench: module.workbench,
    default_operating_mode: module.defaultOperatingMode,
    multi_instance: module.multiInstance,
    definition: module,
})

const toActionRecords = (module: ModuleDefinition): ReadonlyArray<AuthorityActionRecord> =>
    module.authorityActions.map((action, index) => ({
        action: action.action,
        module_key: module.key,
        sort_order: index,
        default_mode: action.mode,
        default_limit_vnd: action.limitVnd,
        default_required_fields: action.requiredFields,
        amount_limit: action.amountLimit,
        max_mode: action.maxMode,
        label: action.label,
    }))

@Injectable()
/** The catalogue of installable agents, served from the typed options, and its mirror in the public.modules tables. */
export class ModulesService {
    constructor(
        @InjectModulesOptions() private readonly options: ModulesOptions,
        @InjectClock() private readonly clock: Clock,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly authorityActions: AuthorityActionsService,
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
     * Mirrors the catalogue into public.modules and public.authority_actions in one transaction (upsert by key and
     * action). Nothing is deleted: a module or an action still referenced by a workspace must not disappear, so the
     * rows the catalogue no longer lists are only reported.
     */
    sync(): Promise<ModulesSyncReport> {
        const problems = checkCatalog(this.options.catalog, this.options.categories)
        if (problems.length > 0) {
            return Promise.reject(
                new ModulesError({ code: ModulesErrorCode.CatalogInvalid, params: { problems: problems.join("; ") } }),
            )
        }
        const modules = JSON.stringify(this.options.catalog.map(toModuleRecord))
        const actions = this.options.catalog.flatMap(toActionRecords)
        const syncedAt = this.clock.now()
        return this.entityManager.transaction(async (tx) => {
            const written = await tx.query<Array<Pick<ModulesRow, "key">>>(UPSERT_MODULES, [modules, syncedAt])
            const synced = await this.authorityActions.upsertAll(tx, actions)
            const held = await tx.query<Array<Pick<ModulesRow, "key">>>(LIST_MODULE_KEYS)
            const keys = new Set(written.map((row) => row.key))
            return {
                modules: written.length,
                actions: synced.written,
                staleModules: held.map((row) => row.key).filter((key) => !keys.has(key)),
                staleActions: synced.stale,
            }
        })
    }
}
