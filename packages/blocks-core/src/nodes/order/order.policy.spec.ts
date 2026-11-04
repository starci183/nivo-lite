import {
    askTextOf,
    gapsOf,
    mergedItems,
    nameKey,
    needsOwner,
    pricedFrom,
    recordedItemsOf,
    resolvedItems,
    totalOf,
} from "./order.policy"
import { sampleOf } from "../../messages/catalog"

const tea = { name: sampleOf("sampleTraSen"), quantity: 2, priceVnd: 120_000 }
const row = (name: string, priceVnd: number | null, active = true) => ({ id: `id-${name}`, name, priceVnd, active })

describe("order policy", () => {
    it("compares names without accents, case or extra spaces", () => {
        expect(nameKey(sampleOf("sampleDuongTraSen"))).toBe("duong tra sen")
        expect(nameKey(sampleOf("sampleD"))).toBe("d")
    })

    it("merges equal names, adds quantities, keeps the first known price and drops blank names", () => {
        expect(
            mergedItems([
                { name: sampleOf("sampleTraSen2"), quantity: 1, priceVnd: null },
                { name: "Tra sen", quantity: 2, priceVnd: 100 },
                { name: "tra SEN", quantity: 1, priceVnd: 9 },
                { name: "  ", quantity: 1, priceVnd: 5 },
                { name: sampleOf("sampleBanh"), quantity: 1, priceVnd: 7 },
            ]),
        ).toEqual([
            { name: sampleOf("sampleTraSen3"), quantity: 4, priceVnd: 100 },
            { name: sampleOf("sampleBanh"), quantity: 1, priceVnd: 7 },
        ])
    })

    it("totals quantity times price, and nothing while a line has no price", () => {
        expect(totalOf([tea, { name: "x", quantity: 1, priceVnd: 5 }])).toBe(240_005)
        expect(totalOf([tea, { name: "y", quantity: 1, priceVnd: null }])).toBeNull()
        expect(totalOf([])).toBe(0)
    })

    it("prices from the active catalogue and names the items it lacks, has retired or has not priced", () => {
        const catalogue = [
            row(sampleOf("sampleTraSen"), 130_000),
            row(sampleOf("sampleBanh"), null),
            row(sampleOf("sampleChe"), 5, false),
        ]

        expect(
            pricedFrom(
                [
                    tea,
                    { name: "banh", quantity: 1, priceVnd: 1 },
                    { name: sampleOf("sampleRuou"), quantity: 1, priceVnd: 1 },
                    { name: sampleOf("sampleChe"), quantity: 1, priceVnd: 1 },
                ],
                catalogue,
            ),
        ).toEqual({
            items: [
                {
                    name: sampleOf("sampleTraSen"),
                    quantity: 2,
                    priceVnd: 130_000,
                    catalogueItemId: sampleOf("sampleIdTraSen"),
                },
            ],
            gaps: [
                { reason: "no_price", item: "banh" },
                { reason: "not_in_catalogue", item: sampleOf("sampleRuou") },
                { reason: "not_in_catalogue", item: sampleOf("sampleChe") },
            ],
        })
    })

    it("finds no gap in a priced order with an address", () => {
        expect(gapsOf([tea], sampleOf("sample12LeLoi"), [row(sampleOf("sampleTraSen"), 1)]).gaps).toEqual([])
    })

    it("asks for the items and for the address", () => {
        expect(gapsOf([], null, []).gaps).toEqual([
            { reason: "no_items", item: null },
            { reason: "no_address", item: null },
        ])
    })

    it("waits for the owner at the threshold and above, not below", () => {
        expect(needsOwner(4_999_999, 5_000_000)).toBe(false)
        expect(needsOwner(5_000_000, 5_000_000)).toBe(true)
        expect(needsOwner(6_000_000, 5_000_000)).toBe(true)
    })

    it("resolves an item to the catalogue and keeps the price asked when the catalogue has none", () => {
        const items = [
            { name: "tra sen", quantity: 1, priceVnd: null },
            { name: sampleOf("sampleBanh"), quantity: 1, priceVnd: 9 },
            { name: sampleOf("sampleRuou"), quantity: 1, priceVnd: 3 },
        ]

        expect(
            resolvedItems(items, [row(sampleOf("sampleTraSen"), 130_000), row(sampleOf("sampleBanh"), null)]),
        ).toEqual([
            {
                name: sampleOf("sampleTraSen"),
                quantity: 1,
                priceVnd: 130_000,
                catalogueItemId: sampleOf("sampleIdTraSen"),
            },
            { name: sampleOf("sampleBanh"), quantity: 1, priceVnd: 9, catalogueItemId: sampleOf("sampleIdBanh") },
            { name: sampleOf("sampleRuou"), quantity: 1, priceVnd: 3 },
        ])
    })

    it("shapes items for the order.record effect, leaving out what is unknown", () => {
        expect(
            recordedItemsOf([
                { name: "A", quantity: 2, priceVnd: 5, catalogueItemId: "c1" },
                { name: "B", quantity: 1, priceVnd: null },
            ]),
        ).toEqual([
            { name: "A", qty: 2, unitPriceVnd: 5, catalogueItemId: "c1" },
            { name: "B", qty: 1 },
        ])
    })

    it("asks for what is missing in the language asked, without a promise", () => {
        const text = askTextOf(
            [
                { reason: "no_items", item: null },
                { reason: "not_in_catalogue", item: sampleOf("sampleRuou") },
                { reason: "no_price", item: sampleOf("sampleBanh") },
                { reason: "no_address", item: null },
            ],
            "en",
        )

        expect(text.split("\n")).toEqual([
            "To note down the order, we need a little more:",
            "Which items would you like, and how many?",
            sampleOf("sampleWeDoNotHaveRuouCould"),
            sampleOf("sampleWeHaveNoPriceForBanh"),
            "Could you give us the delivery address?",
        ])
        expect(askTextOf([{ reason: "no_address", item: null }], "vi")).toContain(sampleOf("sampleDiaChi"))
    })
})
