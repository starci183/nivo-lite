import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AuthorityActionsService } from "@modules/domain/authority-actions"
import type { AuthorityActionRecord } from "@modules/domain/authority-actions"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ACCOUNTING_MODULE } from "./accounting.contracts"
import { MODULE_CATEGORIES } from "./categories.contracts"
import { ModulesErrorCode } from "./errors/modules.error"
import { MODULE_CATALOG } from "./modules.catalog.contracts"
import { MODULES_OPTIONS } from "./modules.decorators"
import type { ModulesOptions } from "./modules.options"
import { ModulesService } from "./modules.service"
import { ModuleEntity } from "./persistence/entities"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** A substring matcher, typed `unknown` so it flows into any slot. */
const stringLike = (text: string): unknown => expect.stringContaining(text)

/** A sub-array matcher, typed `unknown` so it flows into any slot. */
const arrayLike = (items: ReadonlyArray<unknown>): unknown => expect.arrayContaining(items)

/** The match-anything matcher, typed `unknown` so it flows into any slot. */
const anything = (): unknown => expect.anything()

const AT = "2026-03-04T05:06:07.000Z"
const OPTIONS: ModulesOptions = { categories: MODULE_CATEGORIES, catalog: MODULE_CATALOG }
const KEYS = MODULE_CATALOG.map((module) => ({ key: module.key }))
const entityOf = (key: string): ModuleEntity => Object.assign(new ModuleEntity(), { key })
const ACTIONS = MODULE_CATALOG.flatMap((module) => module.authorityActions)

/** Builds the service over the catalogue options (with `overrides`) and the given entity manager. */
const build = async (
    overrides: Partial<ModulesOptions> = {},
    entityManager: MockEntityManager = mockEntityManager(),
) => {
    const options = { ...OPTIONS, ...overrides }
    const authorityActions = mock<AuthorityActionsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ModulesService,
            { provide: MODULES_OPTIONS, useValue: options },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AuthorityActionsService, useValue: authorityActions },
        ],
    }).compile()
    return { service: moduleRef.get(ModulesService), authorityActions }
}

const syncTransaction = (held = KEYS) =>
    fakeTransaction(
        mockEntityManager({
            upsert: [ModuleEntity, { identifiers: KEYS }],
            find: [ModuleEntity, held.map((row) => entityOf(row.key))],
        }),
    )

describe("ModulesService > catalog", () => {
    it("answers the categories and the modules of its options", async () => {
        await expect((await build()).service.catalog()).resolves.toEqual({
            categories: MODULE_CATEGORIES,
            modules: MODULE_CATALOG,
        })
    })
})

describe("ModulesService > find", () => {
    it("answers the module with the key", async () => {
        const sales = MODULE_CATALOG.find((module) => module.key === "sales")

        await expect((await build()).service.find("sales")).resolves.toBe(sales)
    })

    it("answers a typed not-found result for a key the catalogue does not list", async () => {
        await expect((await build()).service.find("nope")).rejects.toMatchObject({
            code: ModulesErrorCode.NotFound,
            params: { key: "nope" },
        })
    })
})

describe("ModulesService > sync", () => {
    it("hands the accounting decisions that ask a person to the authority actions", async () => {
        const tx = syncTransaction()
        const { service, authorityActions } = await build({}, tx.em)
        authorityActions.upsertAll.mockResolvedValue({ written: ACTIONS.length, stale: [] })

        await service.sync()

        expect(authorityActions.upsertAll).toHaveBeenCalledWith(
            anything(),
            arrayLike([
                objectLike({
                    action: "record_receivable_payment",
                    module_key: "accounting",
                    default_mode: "ask",
                    default_required_fields: ["amount_vnd"],
                    amount_limit: false,
                }),
                objectLike({
                    action: "review_einvoice",
                    module_key: "accounting",
                    default_mode: "ask",
                    default_required_fields: [],
                    amount_limit: false,
                }),
            ]),
        )
    })

    it("upserts the modules and hands the actions to the authority actions in the same transaction", async () => {
        const tx = syncTransaction()
        const { service, authorityActions } = await build({}, tx.em)
        authorityActions.upsertAll.mockResolvedValue({ written: ACTIONS.length, stale: ["retired_action"] })

        const report = await service.sync()

        expect(report).toEqual({
            modules: KEYS.length,
            actions: ACTIONS.length,
            staleModules: [],
            staleActions: ["retired_action"],
        })
        expect(tx.commits).toBe(1)
        expect(authorityActions.upsertAll).toHaveBeenCalledWith(
            anything(),
            arrayLike([
                {
                    action: "issue_invoice",
                    module_key: "accounting",
                    sort_order: 0,
                    default_mode: "auto",
                    default_limit_vnd: 20000000,
                    default_required_fields: ["customer", "amount_vnd"],
                    amount_limit: true,
                    max_mode: null,
                    label: ACCOUNTING_MODULE.authorityActions[0]?.label,
                },
            ]),
        )
    })
})

describe("ModulesService > sync", () => {
    it("writes each module with its columns and its whole definition, stamped with the clock", async () => {
        const tx = syncTransaction()
        const { service, authorityActions } = await build({}, tx.em)
        authorityActions.upsertAll.mockResolvedValue({ written: 0, stale: [] })

        await service.sync()

        const expected = MODULE_CATALOG.map((module) => ({
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
            updatedAt: new Date(AT),
        }))
        expect(tx.em.upsert).toHaveBeenCalledWith(ModuleEntity, expected, ["key"])
    })

    it("reports persisted modules missing from the catalogue without deleting them", async () => {
        const tx = syncTransaction([...KEYS, { key: "retired" }])
        const { service, authorityActions } = await build({}, tx.em)
        authorityActions.upsertAll.mockResolvedValue({ written: 1, stale: [] })

        await expect(service.sync()).resolves.toMatchObject({
            staleModules: ["retired"],
        })
    })
})

describe("ModulesService > sync", () => {
    it("refuses a catalogue that breaks its own rules and writes nothing", async () => {
        const entityManager = mockEntityManager()
        const { service } = await build({ categories: [] }, entityManager)

        await expect(service.sync()).rejects.toMatchObject({
            code: ModulesErrorCode.CatalogInvalid,
            params: { problems: stringLike("unknown category") },
        })
        expect(entityManager.transaction).not.toHaveBeenCalled()
    })
})

describe("ModulesService > ensure", () => {
    const record = (action: string): AuthorityActionRecord => ({
        action,
        module_key: "m",
        sort_order: 0,
        default_mode: "ask",
        default_limit_vnd: null,
        default_required_fields: [],
        amount_limit: false,
        max_mode: null,
        label: { vi: action, en: action },
    })
    const names = ACTIONS.map((action) => action.action)

    it("prints the counts when the database holds every default-rule action", async () => {
        const { service, authorityActions } = await build({}, syncTransaction().em)
        authorityActions.upsertAll.mockResolvedValue({ written: ACTIONS.length, stale: [] })
        authorityActions.list.mockResolvedValue(names.map(record))
        const output = { write: jest.fn() }

        await service.ensure(output)

        expect(output.write).toHaveBeenCalledWith(`catalogue ok ${KEYS.length} ${ACTIONS.length}\n`)
    })

    it("fails naming each action a default rule grants that the database lacks, and prints no success", async () => {
        const { service, authorityActions } = await build({}, syncTransaction().em)
        authorityActions.upsertAll.mockResolvedValue({ written: ACTIONS.length, stale: [] })
        const missing = names[0] ?? ""
        authorityActions.list.mockResolvedValue(names.filter((action) => action !== missing).map(record))
        const output = { write: jest.fn() }

        await expect(service.ensure(output)).rejects.toMatchObject({
            code: ModulesErrorCode.CatalogUnresolved,
            params: { actions: missing },
        })
        expect(output.write).not.toHaveBeenCalled()
    })

    it("rejects with the catalogue error and reads nothing when the catalogue is invalid", async () => {
        const { service, authorityActions } = await build({ categories: [] })

        await expect(service.ensure({ write: jest.fn() })).rejects.toMatchObject({
            code: ModulesErrorCode.CatalogInvalid,
        })
        expect(authorityActions.list).not.toHaveBeenCalled()
    })
})
