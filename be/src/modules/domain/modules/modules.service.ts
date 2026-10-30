import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AuthorityActionsService } from "@modules/domain/authority-actions"
import type { AuthorityActionRecord } from "@modules/domain/authority-actions"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ModulesError, ModulesErrorCode } from "./errors/modules.error"
import { InjectModulesOptions } from "./modules.decorators"
import type { ModuleDefinition, ModulesCatalog, ModulesOutput, ModulesSyncReport } from "./modules.contracts"
import type { ModulesOptions } from "./modules.options"
import { ModuleEntity } from "./persistence/entities"
import { checkCatalog } from "./policies/catalog.policy"
import { defaultRulesOf } from "./policies/instance.policy"

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
        const actions = this.options.catalog.flatMap(toActionRecords)
        const modules = this.options.catalog.map((module) => toModuleRecord(module))
        return this.entityManager.transaction(async (tx) => {
            const upserted = await tx.upsert(ModuleEntity, modules, ["key"])
            const written = upserted.identifiers.map((identifier) => ({ key: String(identifier.key) }))
            const synced = await this.authorityActions.upsertAll(tx, actions)
            const held = await tx.find(ModuleEntity, {
                select: { key: true },
                order: { key: "ASC" },
                take: MODULES_LIMIT,
            })
            const keys = new Set(written.map((row) => row.key))
            return {
                modules: written.length,
                actions: synced.written,
                staleModules: held.map((row) => row.key).filter((key) => !keys.has(key)),
                staleActions: synced.stale,
            }
        })
    }

    /**
     * Syncs the catalogue, then proves every action a module's default rules grant exists in public.authority_actions and
     * prints `catalogue ok <modules> <actions>`: the deploy runs this so a catalogue that fell behind the code cannot
     * reach a workspace sheet. An unresolved action is a typed failure, never a printed success.
     */
    async ensure(output: ModulesOutput): Promise<void> {
        const report = await this.sync()
        const held = new Set((await this.authorityActions.list(this.entityManager)).map((row) => row.action))
        const wanted = this.options.catalog.flatMap((module) => defaultRulesOf(module).map((rule) => rule.action))
        const unresolved = [...new Set(wanted.filter((action) => !held.has(action)))]
        if (unresolved.length > 0) {
            throw new ModulesError({
                code: ModulesErrorCode.CatalogUnresolved,
                params: { actions: unresolved.join(",") },
            })
        }
        output.write(`catalogue ok ${report.modules} ${report.actions}\n`)
    }
}
