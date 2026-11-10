import { Test } from "@nestjs/testing"
import { readCatalogueItems } from "./catalogue-seed.policy"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { CATALOGUE_SEED_SCHEMA } from "./catalogue-seed.contracts"

const refused = (field: string) =>
    new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })

const item = (overrides: Record<string, unknown> = {}) => ({
    sku: "CHAU-MINI",
    name: "Mini pot",
    unit: "pot",
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

const SUBJECT = Symbol("catalogue-seed.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { readCatalogueItems } }],
    }).compile()
    return moduleRef.get<typeof import("./catalogue-seed.policy")>(SUBJECT)
}

describe("readCatalogueItems", () => {
    let policy: typeof import("./catalogue-seed.policy")

    beforeAll(async () => {
        policy = await build()
    })

    it("reads the items of every document, in order", () => {
        const items = policy.readCatalogueItems(
            envelope(
                document([item(), item({ sku: "BO-HONG-20", sellPriceVnd: 0 })]),
                document([item({ sku: "KE-1" })]),
            ),
        )

        expect(items.map((read) => [read.sku, read.sellPriceVnd])).toEqual([
            ["CHAU-MINI", 5000],
            ["BO-HONG-20", 0],
            ["KE-1", 5000],
        ])
        expect(items[0]).toEqual({ sku: "CHAU-MINI", name: "Mini pot", unit: "pot", sellPriceVnd: 5000 })
    })

    it("reads the photo of an item as its content type and base64 bytes", () => {
        const image = { contentType: "image/jpeg", base64: "anBlZy1ieXRlcw==" }

        const [read] = policy.readCatalogueItems(envelope(document([item({ image })])))

        expect(read?.image).toEqual(image)
    })

    it.each([
        ["a photo that is not an object", envelope(document([item({ image: "x" })])), "item.image"],
        [
            "a photo of a type no photo may have",
            envelope(document([item({ image: { contentType: "image/gif", base64: "AAAA" } })])),
            "item.image.contentType",
        ],
        [
            "a photo that is not base64",
            envelope(document([item({ image: { contentType: "image/png", base64: "not base64!" } })])),
            "item.image.base64",
        ],
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
        expect(() => policy.readCatalogueItems(text)).toThrow(refused(field))
    })
})

describe("readCatalogueItems: an item that shares the photo of another", () => {
    const image = { contentType: "image/jpeg", base64: "anBlZy1ieXRlcw==" }

    it("gets the photo of the item it names, wherever that item stands in the documents", async () => {
        const policy = await build()

        const items = policy.readCatalogueItems(
            envelope(
                document([item({ sku: "BO-HONG-20", imageOf: "BO-HONG-MINI" })]),
                document([item({ sku: "BO-HONG-MINI", image })]),
            ),
        )

        expect(items.map((read) => [read.sku, read.image])).toEqual([
            ["BO-HONG-20", image],
            ["BO-HONG-MINI", image],
        ])
        expect(items[0]).not.toHaveProperty("imageOf")
    })

    it.each([
        ["an item that is not there", [item({ imageOf: "NONE" })]],
        ["an item without a photo", [item({ imageOf: "KE-1" }), item({ sku: "KE-1" })]],
        ["itself", [item({ imageOf: "CHAU-MINI" })]],
        ["an item while carrying a photo of its own", [item({ imageOf: "KE-1", image }), item({ sku: "KE-1", image })]],
    ])("refuses a shared photo of %s", async (_name, items) => {
        const policy = await build()

        expect(() => policy.readCatalogueItems(envelope(document(items)))).toThrow(refused("item.imageOf"))
    })
})
