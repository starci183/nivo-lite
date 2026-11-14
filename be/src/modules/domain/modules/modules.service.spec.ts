import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MODULE_CATEGORIES } from "./categories.contracts"
import { ModulesErrorCode } from "./errors/modules.error"
import { MODULE_CATALOG } from "./modules.catalog.contracts"
import { MODULES_OPTIONS } from "./modules.decorators"
import type { ModulesOptions } from "./modules.options"
import { ModulesService } from "./modules.service"
import { ModuleEntity } from "./persistence/entities"

/** A substring matcher, typed `unknown` so it flows into any slot. */
const stringLike = (text: string): unknown => expect.stringContaining(text)


const OPTIONS: ModulesOptions = { categories: MODULE_CATEGORIES, catalog: MODULE_CATALOG }
const KEYS = MODULE_CATALOG.map((module) => ({ key: module.key }))
const entityOf = (key: string): ModuleEntity => Object.assign(new ModuleEntity(), { key })

/** Builds the service over the catalogue options (with `overrides`) and the given entity manager. */
const build = async (
    overrides: Partial<ModulesOptions> = {},
    entityManager: MockEntityManager = mockEntityManager(),
) => {
    const options = { ...OPTIONS, ...overrides }
    const moduleRef = await Test.createTestingModule({
        providers: [
            ModulesService,
            { provide: MODULES_OPTIONS, useValue: options },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
        ],
    }).compile()
    return { service: moduleRef.get(ModulesService) }
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
    it("writes each module with its columns and its whole definition", async () => {
        const tx = syncTransaction()
        const { service } = await build({}, tx.em)

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
        }))
        expect(tx.em.upsert).toHaveBeenCalledWith(ModuleEntity, expected, ["key"])
    })

    it("reports persisted modules missing from the catalogue without deleting them", async () => {
        const tx = syncTransaction([...KEYS, { key: "retired" }])
        const { service } = await build({}, tx.em)

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
    it("syncs the catalogue and prints the module count", async () => {
        const { service } = await build({}, syncTransaction().em)
        const output = { write: jest.fn() }

        await service.ensure(output)

        expect(output.write).toHaveBeenCalledWith(`catalogue ok ${KEYS.length}
`)
    })

    it("rejects with the catalogue error and prints nothing when the catalogue is invalid", async () => {
        const { service } = await build({ categories: [] })
        const output = { write: jest.fn() }

        await expect(service.ensure(output)).rejects.toMatchObject({
            code: ModulesErrorCode.CatalogInvalid,
        })
        expect(output.write).not.toHaveBeenCalled()
    })
})
