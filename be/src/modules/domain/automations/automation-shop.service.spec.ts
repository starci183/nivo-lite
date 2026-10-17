import { NEUTRAL_VARIABLES, SAMPLE_VARIABLES } from "./words.contracts"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MessageCatalog } from "@modules/platform/i18n"
import { AutomationShopService } from "./automation-shop.service"
import { buildInstallation, buildOverviewRows } from "@tests/fixtures/builders/automations.builder"
import { SELECT_OVERVIEW } from "./persistence/automations.sql"
import type { MockEntityManager } from "@starci/jest-preset"

const build = async (em: MockEntityManager) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params, locale) => {
        if (key === "automations.moduleName.sales") return locale === "vi" ? "Ban hang" : "Sales"
        if (key.startsWith("automations.moduleName.")) return key
        return `${locale}:${key}:${JSON.stringify(params)}`
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationShopService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { shop: moduleRef.get(AutomationShopService), em }
}

describe("AutomationShopService overviewRows", () => {
    it("reads every row of the screen in one call", async () => {
        const rows = buildOverviewRows({ workspace_name: "Tiem Hoa" })
        const { shop, em } = await build(mockEntityManager({ query: [SELECT_OVERVIEW, [{ data: rows }]] }))

        await expect(shop.overviewRows("ws-1")).resolves.toBe(rows)

        expect(em.query).toHaveBeenCalledWith(SELECT_OVERVIEW, ["ws-1"])
    })

    it("reads an empty workspace when the function answers nothing", async () => {
        const { shop } = await build(mockEntityManager({ query: [SELECT_OVERVIEW, []] }))

        await expect(shop.overviewRows("ws-1")).resolves.toMatchObject({
            installations: [],
            workspace_name: null,
            contracts: 0,
        })
    })
})
describe("AutomationShopService shopPatterns", () => {
    it("compiles the language data once, case-insensitively", async () => {
        const { shop } = await build(mockEntityManager({}))

        const patterns = shop.shopPatterns()

        expect(patterns).toBe(shop.shopPatterns())
        expect(patterns.due.test("VI:AUTOMATIONS.PATTERN.DUE:{}")).toBe(true)
        expect(patterns.capabilities.has_delivery.source).toBe("vi:automations.pattern.has_delivery:{}")
    })
})
describe("AutomationShopService shop and context", () => {
    const rows = buildOverviewRows({
        workspace_name: "Tiem Hoa",
        authority: { brand_voice: "warm" },
        installations: [
            buildInstallation({
                module_key: "sales",
                ctx: { id: "c-1", version: 4, snapshot: { summary: "We sell flowers." } },
            }),
        ],
    })
    it("tells the shop of rows already read", async () => {
        const { shop } = await build(mockEntityManager({}))

        expect(shop.contextsOf(rows).versions).toEqual({ sales: 4 })
        expect(shop.shopFrom(rows)).toMatchObject({ shop: "Tiem Hoa", tone: "warm", hoursRange: null })
    })

    it("tells the shop of a workspace", async () => {
        const { shop } = await build(mockEntityManager({ query: [SELECT_OVERVIEW, [{ data: rows }]] }))

        await expect(shop.shopOf("ws-1")).resolves.toMatchObject({ shop: "Tiem Hoa" })
    })

    it("gives the context text and the version a template is written from", async () => {
        const { shop } = await build(mockEntityManager({ query: [SELECT_OVERVIEW, [{ data: rows }]] }))

        await expect(shop.contextFor("ws-1", "sales")).resolves.toEqual({ text: "We sell flowers.", version: 4 })
        await expect(shop.contextFor("ws-1", null)).resolves.toEqual({ text: "We sell flowers.", version: 4 })
    })
})
describe("AutomationShopService labeller", () => {
    it("names a missing module in both languages and falls back on its key", async () => {
        const label = (await build(mockEntityManager({}))).shop.labeller()

        expect(label("module", "sales")).toEqual({
            vi: 'vi:automations.missing.module:{"name":"Ban hang"}',
            en: 'en:automations.missing.module:{"name":"Sales"}',
        })
        expect(label("module", "booking").vi).toBe('vi:automations.missing.module:{"name":"booking"}')
    })

    it("names any other missing requirement from the catalog", async () => {
        const label = (await build(mockEntityManager({}))).shop.labeller()

        expect(label("capability", "has_deposits")).toEqual({
            vi: "vi:automations.missing.capability.has_deposits:{}",
            en: "en:automations.missing.capability.has_deposits:{}",
        })
    })
})
describe("AutomationShopService sample and localized", () => {
    it("fills a preview with the sample values and the neutral words of the catalog", async () => {
        const sample = (await build(mockEntityManager({}))).shop.sample()

        expect(sample.variables.ten_khach).toBe("vi:automations.sample.ten_khach:{}")
        expect(sample.neutral.ten_shop).toBe("vi:automations.neutral.ten_shop:{}")
    })

    it("writes a text in both languages", async () => {
        const { shop } = await build(mockEntityManager({}))

        expect(shop.localized("k", { a: 1 })).toEqual({ vi: 'vi:k:{"a":1}', en: 'en:k:{"a":1}' })
        expect(shop.localized("k")).toEqual({ vi: "vi:k:{}", en: "en:k:{}" })
    })
})

describe("variable lists", () => {
    it("names the variables a blank reads as a neutral word", async () => {
        const { shop } = await build(mockEntityManager({}))
        expect(NEUTRAL_VARIABLES).toContain("ten_khach")
        expect(shop.sample().neutral.ten_khach).toBe("vi:automations.neutral.ten_khach:{}")
        expect(new Set(NEUTRAL_VARIABLES).size).toBe(NEUTRAL_VARIABLES.length)
    })

    it("names the variables a preview fills with a sample", async () => {
        const { shop } = await build(mockEntityManager({}))
        expect(SAMPLE_VARIABLES).toContain("tom_tat")
        expect(shop.sample().variables.tom_tat).toBe("vi:automations.sample.tom_tat:{}")
        expect(new Set(SAMPLE_VARIABLES).size).toBe(SAMPLE_VARIABLES.length)
    })
})
