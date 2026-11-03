import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { CATALOGUE_SEED_SCHEMA } from "./catalogue-seed.contracts"
import { readCatalogueItems } from "./catalogue-seed.policy"

const refused = (field: string) =>
    new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })

const item = (overrides: Record<string, unknown> = {}) => ({
    sku: "CHAU-MINI",
    name: "Chậu hoa mini",
    unit: "chậu",
    sellPriceVnd: 5000,
    ...overrides,
})
const envelope = (...documents: ReadonlyArray<unknown>): string =>
    `${JSON.stringify({ documents: documents.map((document) => ({ path: "data/catalogue.json", document })) })}\n`
const document = (items: unknown, overrides: Record<string, unknown> = {}) => ({
    schema: CATALOGUE_SEED_SCHEMA,
    items,
    ...overrides,
})

describe("readCatalogueItems", () => {
    it("reads the items of every document, in order", () => {
        const items = readCatalogueItems(
            envelope(document([item(), item({ sku: "BO-HONG-20", sellPriceVnd: 0 })]), document([item({ sku: "KE-1" })])),
        )

        expect(items.map((read) => [read.sku, read.sellPriceVnd])).toEqual([
            ["CHAU-MINI", 5000],
            ["BO-HONG-20", 0],
            ["KE-1", 5000],
        ])
        expect(items[0]).toEqual({ sku: "CHAU-MINI", name: "Chậu hoa mini", unit: "chậu", sellPriceVnd: 5000 })
    })

    it.each([
        ["a document of another schema", envelope({ schema: "nivo/other@1", items: [item()] }), "schema"],
        ["a document that is not an object", envelope("x"), "schema"],
        ["a document with no items", envelope(document([])), "items"],
        ["items that are not a list", envelope(document("x")), "items"],
        ["an item that is not an object", envelope(document(["x"])), "item"],
        ["a sku in lower case", envelope(document([item({ sku: "chau-mini" })])), "item.sku"],
        ["a sku that is not text", envelope(document([item({ sku: 5 })])), "item.sku"],
        ["a price with decimals", envelope(document([item({ sellPriceVnd: 5000.5 })])), "item.sellPriceVnd"],
        ["a negative price", envelope(document([item({ sellPriceVnd: -1 })])), "item.sellPriceVnd"],
        ["a price that is text", envelope(document([item({ sellPriceVnd: "5000" })])), "item.sellPriceVnd"],
        ["a name that is empty", envelope(document([item({ name: " " })])), "item.name"],
        ["a unit that is missing", envelope(document([item({ unit: undefined })])), "item.unit"],
        ["a sku given twice", envelope(document([item(), item({ name: "Other" })])), "item.sku"],
    ])("refuses %s", (_name, text, field) => {
        expect(() => readCatalogueItems(text)).toThrow(refused(field))
    })
})
