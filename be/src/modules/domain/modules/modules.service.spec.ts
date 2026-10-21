import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AuthorityActionsService } from "@modules/domain/authority-actions"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ACCOUNTING_MODULE } from "./accounting.contracts"
import { MODULE_CATEGORIES } from "./categories.contracts"
import { ModulesErrorCode } from "./errors/modules.error"
import { MODULE_CATALOG } from "./modules.catalog.contracts"
import { MODULES_OPTIONS } from "./modules.decorators"
import type { ModulesOptions } from "./modules.options"
import { ModulesService } from "./modules.service"
import { LIST_MODULE_KEYS, UPSERT_MODULES } from "./persistence/modules.sql"

const AT = "2026-03-04T05:06:07.000Z"
const OPTIONS: ModulesOptions = { categories: MODULE_CATEGORIES, catalog: MODULE_CATALOG }
const KEYS = MODULE_CATALOG.map((module) => ({ key: module.key }))
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
            query: [
                [UPSERT_MODULES, KEYS],
                [LIST_MODULE_KEYS, held],
            ],
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
            expect.anything(),
            expect.arrayContaining([
                expect.objectContaining({
                    action: "record_receivable_payment",
                    module_key: "accounting",
                    default_mode: "ask",
                    default_required_fields: ["amount_vnd"],
                    amount_limit: false,
                }),
                expect.objectContaining({
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
            expect.anything(),
            expect.arrayContaining([
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
            sort_order: module.order,
            status: module.status,
            category: module.category,
            audience: module.audience,
            knowledge_folder: module.knowledgeFolder,
            workbench: module.workbench,
            default_operating_mode: module.defaultOperatingMode,
            multi_instance: module.multiInstance,
            definition: module,
        }))
        expect(tx.em.query).toHaveBeenCalledWith(UPSERT_MODULES, [JSON.stringify(expected), new Date(AT)])
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
            params: { problems: expect.stringContaining("unknown category") },
        })
        expect(entityManager.transaction).not.toHaveBeenCalled()
    })
})
