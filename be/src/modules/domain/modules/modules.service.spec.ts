import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AuthorityActionsService } from "@modules/domain/authority-actions"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
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

const build = async (
    options: ModulesOptions,
    entityManager: MockEntityManager = mockEntityManager(),
    authorityActions = mock<AuthorityActionsService>(),
) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            ModulesService,
            { provide: MODULES_OPTIONS, useValue: options },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AuthorityActionsService, useValue: authorityActions },
        ],
    }).compile()
    return moduleRef.get(ModulesService)
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

describe("ModulesService", () => {
    describe("catalog", () => {
        it("answers the categories and the modules of its options", async () => {
            await expect((await build(OPTIONS)).catalog()).resolves.toEqual({
                categories: MODULE_CATEGORIES,
                modules: MODULE_CATALOG,
            })
        })
    })

    describe("find", () => {
        it("answers the module with the key", async () => {
            const sales = MODULE_CATALOG.find((module) => module.key === "sales")

            await expect((await build(OPTIONS)).find("sales")).resolves.toBe(sales)
        })

        it("answers a typed not-found result for a key the catalogue does not list", async () => {
            await expect((await build(OPTIONS)).find("nope")).rejects.toMatchObject({
                code: ModulesErrorCode.NotFound,
                params: { key: "nope" },
            })
        })
    })

    describe("sync", () => {
        it("upserts the modules and hands the actions to the authority actions in the same transaction", async () => {
            const tx = syncTransaction()
            const authorityActions = mock<AuthorityActionsService>()
            authorityActions.upsertAll.mockResolvedValue({ written: ACTIONS.length, stale: ["retired_action"] })

            const report = await (await build(OPTIONS, tx.em, authorityActions)).sync()

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
                        label: { vi: expect.any(String), en: "Issue invoice" },
                    },
                ]),
            )
        })

        it("writes each module with its columns and its whole definition, stamped with the clock", async () => {
            const tx = syncTransaction()
            const authorityActions = mock<AuthorityActionsService>()
            authorityActions.upsertAll.mockResolvedValue({ written: 0, stale: [] })

            await (await build(OPTIONS, tx.em, authorityActions)).sync()

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

        it("reports the module rows the database holds that the catalogue no longer lists, and deletes nothing", async () => {
            const tx = syncTransaction([...KEYS, { key: "retired" }])
            const authorityActions = mock<AuthorityActionsService>()
            authorityActions.upsertAll.mockResolvedValue({ written: 1, stale: [] })

            await expect((await build(OPTIONS, tx.em, authorityActions)).sync()).resolves.toMatchObject({
                staleModules: ["retired"],
            })
        })

        it("refuses a catalogue that breaks its own rules and writes nothing", async () => {
            const entityManager = mockEntityManager()
            const broken: ModulesOptions = { categories: [], catalog: MODULE_CATALOG }

            await expect((await build(broken, entityManager)).sync()).rejects.toMatchObject({
                code: ModulesErrorCode.CatalogInvalid,
                params: { problems: expect.stringContaining("unknown category") },
            })
            expect(entityManager.transaction).not.toHaveBeenCalled()
        })
    })
})
