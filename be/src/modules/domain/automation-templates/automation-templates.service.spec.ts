import { Test } from "@nestjs/testing"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import {
    definitionOf,
    invalidTemplateRow,
    storedTemplateAOne,
} from "@tests/fixtures/builders/automation-templates.builder"
import { TEMPLATE_CATALOG } from "./automation-templates.templates"
import { AutomationTemplatesLogEvent } from "./automation-templates.log-events"
import { AutomationTemplatesService } from "./automation-templates.service"
import { AutomationTemplatesErrorCode } from "./errors/automation-templates.error"
import { AutomationTemplateEntity } from "./persistence/entities"

/** Stands for the `() => "now()"` expression a write hands the database. */
const SQL_EXPRESSION: unknown = expect.any(Function)

/** Stands for the stored definition a sync writes: it contains the catalogue entry. */
const EXPECTED_DEFINITION: unknown = expect.objectContaining(definitionOf("a_two", 2))

const build = async (em: MockEntityManager) => {
    const clock = new FakeClock("2026-10-12T10:00:00.000Z")
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationTemplatesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { catalog: moduleRef.get(AutomationTemplatesService), clock, logger }
}

describe("AutomationTemplatesService", () => {
    describe("listTemplates", () => {
        it("reads the catalogue once and reuses it for a minute", async () => {
            const em = mockEntityManager({
                find: [AutomationTemplateEntity, [storedTemplateAOne()]],
            })
            const { catalog, clock } = await build(em)

            const first = await catalog.listTemplates()
            clock.advance(59_000)
            const second = await catalog.listTemplates()

            expect(first.map((template) => template.key)).toEqual(["a_one"])
            expect(second).toBe(first)
            expect(em.find).toHaveBeenCalledTimes(1)
        })

        it("reads the catalogue again once the minute is over", async () => {
            const em = mockEntityManager({
                find: [AutomationTemplateEntity, [storedTemplateAOne()]],
            })
            const { catalog, clock } = await build(em)

            await catalog.listTemplates()
            clock.advance(60_000)
            await catalog.listTemplates()

            expect(em.find).toHaveBeenCalledTimes(2)
        })

        it("refuses a stored definition that is not a template", async () => {
            const em = mockEntityManager({ find: [AutomationTemplateEntity, [invalidTemplateRow()]] })
            const { catalog } = await build(em)

            await expect(catalog.listTemplates()).rejects.toMatchObject({
                code: AutomationTemplatesErrorCode.DefinitionInvalid,
            })
        })
    })

    describe("templateOf", () => {
        it("answers the template of a key and refuses an unknown one", async () => {
            const em = mockEntityManager({
                find: [AutomationTemplateEntity, [storedTemplateAOne()]],
            })
            const { catalog } = await build(em)

            await expect(catalog.templateOf("a_one")).resolves.toMatchObject({ key: "a_one" })
            await expect(catalog.templateOf("missing")).rejects.toMatchObject({
                code: AutomationTemplatesErrorCode.TemplateUnknown,
            })
        })
    })
})

describe("AutomationTemplatesService", () => {
    describe("syncCatalog", () => {
        it("writes every definition in one transaction and forgets the cached catalogue", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    find: [AutomationTemplateEntity, []],
                    upsert: [AutomationTemplateEntity, {}],
                }),
            )
            const { catalog } = await build(tx.em)
            await catalog.listTemplates()

            await expect(catalog.syncCatalog([definitionOf("a_one", 1), definitionOf("a_two", 2)])).resolves.toEqual([
                "a_one",
                "a_two",
            ])
            await catalog.listTemplates()

            expect(tx.commits).toBe(1)
            expect(tx.em.upsert).toHaveBeenCalledWith(
                AutomationTemplateEntity,
                {
                    key: "a_two",
                    version: 2,
                    moduleKey: "sales",
                    pack: "core",
                    executor: "implemented",
                    position: 2,
                    definition: EXPECTED_DEFINITION,
                    updatedAt: SQL_EXPRESSION,
                },
                ["key"],
            )
            expect(tx.em.find).toHaveBeenCalledTimes(2)
            expect(tx.em.upsert).toHaveBeenCalledTimes(2)
        })

        it("writes nothing when one definition is invalid", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const { catalog } = await build(tx.em)

            await expect(catalog.syncCatalog([definitionOf("a_one", 1), { key: "a_two" }])).rejects.toMatchObject({
                code: AutomationTemplatesErrorCode.DefinitionInvalid,
            })

            expect(tx.outcomes).toEqual([])
        })
    })

    describe("syncFromCatalog", () => {
        it("writes every template of the TypeScript catalogue and logs the keys", async () => {
            const tx = fakeTransaction(mockEntityManager({ upsert: [AutomationTemplateEntity, {}] }))
            const { catalog, logger } = await build(tx.em)

            const keys = await catalog.syncFromCatalog()

            expect(keys).toEqual(TEMPLATE_CATALOG.map((template) => template.key))
            expect(new Set(keys).size).toBe(keys.length)
            expect(logger.info).toHaveBeenCalledWith(AutomationTemplatesLogEvent.CatalogSynced, {
                count: keys.length,
                keys,
            })
        })
    })
})
