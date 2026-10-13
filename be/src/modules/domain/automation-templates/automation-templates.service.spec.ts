import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TEMPLATE_CATALOG } from "./automation-templates.templates"
import { AutomationTemplatesLogEvent } from "./automation-templates.log-events"
import { AutomationTemplatesService } from "./automation-templates.service"
import { AutomationTemplatesErrorCode } from "./errors/automation-templates.error"
import { SELECT_TEMPLATES, UPSERT_TEMPLATE } from "./persistence/automation-templates.sql"

const text = { vi: "Hello there", en: "Hello" }

const definitionOf = (key: string, position: number) => ({
    key,
    version: 2,
    position,
    pack: "core",
    executor: "implemented",
    moduleKey: "sales",
    icon: "payment",
    name: text,
    description: text,
    trigger: { kind: "event", event: "payment.received", line: text },
    requires: { modules: [], channels: [], connections: [], capabilities: [] },
    settings: [],
    contentMode: "none",
    guardrails: [],
    variables: [],
    defaultBody: null,
    authority: { action: null },
    defaults: {},
})

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
                query: [SELECT_TEMPLATES, [{ key: "a_one", definition: definitionOf("a_one", 1) }]],
            })
            const { catalog, clock } = await build(em)

            const first = await catalog.listTemplates()
            clock.advance(59_000)
            const second = await catalog.listTemplates()

            expect(first.map((template) => template.key)).toEqual(["a_one"])
            expect(second).toBe(first)
            expect(em.query).toHaveBeenCalledTimes(1)
        })

        it("reads the catalogue again once the minute is over", async () => {
            const em = mockEntityManager({
                query: [SELECT_TEMPLATES, [{ key: "a_one", definition: definitionOf("a_one", 1) }]],
            })
            const { catalog, clock } = await build(em)

            await catalog.listTemplates()
            clock.advance(60_000)
            await catalog.listTemplates()

            expect(em.query).toHaveBeenCalledTimes(2)
        })

        it("refuses a stored definition that is not a template", async () => {
            const em = mockEntityManager({ query: [SELECT_TEMPLATES, [{ key: "bad", definition: {} }]] })
            const { catalog } = await build(em)

            await expect(catalog.listTemplates()).rejects.toMatchObject({
                code: AutomationTemplatesErrorCode.DefinitionInvalid,
            })
        })
    })

    describe("templateOf", () => {
        it("answers the template of a key and refuses an unknown one", async () => {
            const em = mockEntityManager({
                query: [SELECT_TEMPLATES, [{ key: "a_one", definition: definitionOf("a_one", 1) }]],
            })
            const { catalog } = await build(em)

            await expect(catalog.templateOf("a_one")).resolves.toMatchObject({ key: "a_one" })
            await expect(catalog.templateOf("missing")).rejects.toMatchObject({
                code: AutomationTemplatesErrorCode.TemplateUnknown,
            })
        })
    })

    describe("syncCatalog", () => {
        it("writes every definition in one transaction and forgets the cached catalogue", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [SELECT_TEMPLATES, []],
                        [UPSERT_TEMPLATE, [{ key: "k" }]],
                    ],
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
            expect(tx.em.query).toHaveBeenCalledWith(UPSERT_TEMPLATE, [
                "a_two",
                2,
                "sales",
                "core",
                "implemented",
                2,
                JSON.stringify(definitionOf("a_two", 2)),
            ])
            expect(tx.em.query).toHaveBeenCalledTimes(1 + 2 + 1)
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
            const tx = fakeTransaction(mockEntityManager({ query: [UPSERT_TEMPLATE, [{ key: "k" }]] }))
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
