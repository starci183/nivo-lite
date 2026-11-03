import { Test } from "@nestjs/testing"
import { nameBefore, orderInMessage, pricedItemsOf } from "./order-reading.policy"
const SUBJECT = Symbol("order-reading.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { nameBefore, orderInMessage, pricedItemsOf } }],
    }).compile()
    return moduleRef.get<typeof import("./order-reading.policy")>(SUBJECT)
}

/** The Sales knowledge of the r28 live probe, as the prompt carried it (the price list, the threshold and the budget lines). */
const SALES_KNOWLEDGE = `### NIVO setup v3
Ti\u1ec7m hoa N\u1eafng Mai b\u00e1n gi\u1ecf hoa khai tr\u01b0\u01a1ng v\u1edbi b\u1ea3ng gi\u00e1 c\u1ed1 \u0111\u1ecbnh: gi\u1ecf hoa nh\u1ecf 3.500.000 \u0111\u1ed3ng, gi\u1ecf hoa l\u1edbn 17.500.000 \u0111\u1ed3ng, giao mi\u1ec5n ph\u00ed v\u00e0 kh\u00f4ng gi\u1ea3m gi\u00e1. Kh\u00e1ch ti\u1ec1m n\u0103ng l\u00e0 ng\u01b0\u1eddi h\u1ecfi mua gi\u1ecf hoa khai tr\u01b0\u01a1ng, \u0111\u1ec3 l\u1ea1i t\u00ean v\u00e0 s\u1ed1 \u0111i\u1ec7n tho\u1ea1i v\u1edbi ng\u00e2n s\u00e1ch t\u1eeb 2 tri\u1ec7u \u0111\u1ed3ng; nh\u1ecbp theo d\u00f5i: nh\u1eafn l\u1ea1i sau 1 ng\u00e0y, t\u1ed1i \u0111a 2 l\u1ea7n. \u0110\u01a1n t\u1eeb 5.000.000 \u0111\u1ed3ng tr\u1edf l\u00ean ph\u1ea3i \u0111\u01b0\u1ee3c ch\u1ee7 c\u1eeda h\u00e0ng duy\u1ec7t, d\u01b0\u1edbi m\u1ee9c \u0111\u00f3 t\u1ef1 x\u00e1c nh\u1eadn.
- Gi\u00e1 tr\u1ecdn g\u00f3i: gi\u1ecf hoa nh\u1ecf 3.500.000 \u0111\u1ed3ng, gi\u1ecf hoa l\u1edbn 17.500.000 \u0111\u1ed3ng. Giao mi\u1ec5n ph\u00ed, kh\u00f4ng gi\u1ea3m gi\u00e1.
- G\u00f3i b\u00e1n v\u00e0 quy t\u1eafc gi\u00e1: B\u00e1n gi\u1ecf hoa, b\u1ea3ng gi\u00e1 c\u1ed1 \u0111\u1ecbnh: gi\u1ecf hoa nh\u1ecf gi\u00e1 tr\u1ecdn g\u00f3i 3.500.000 \u0111\u1ed3ng, gi\u1ecf hoa l\u1edbn gi\u00e1 tr\u1ecdn g\u00f3i 17.500.000 \u0111\u1ed3ng.
- Ng\u01b0\u1ee1ng c\u1ea7n duy\u1ec7t: \u0110\u01a1n h\u00e0ng t\u1eeb 5.000.000 \u0111\u1ed3ng tr\u1edf l\u00ean ph\u1ea3i h\u1ecfi ch\u1ee7 c\u1eeda h\u00e0ng duy\u1ec7t; d\u01b0\u1edbi 5.000.000 \u0111\u1ed3ng th\u00ec t\u1ef1 x\u00e1c nh\u1eadn.
### end NIVO setup`

/** The catalogue of flow C, the names carrying the run's prefix. */
const SKU_KNOWLEDGE =
    "- uat-ae-20261103-62a985-gi\u1ecf-hoa-nh\u1ecf: 3.500.000 \u0111\u1ed3ng\n- uat-ae-20261103-62a985-gi\u1ecf-hoa-l\u1edbn: 17.500.000 \u0111\u1ed3ng"

describe("pricedItemsOf", () => {
    it("reads each price the owner wrote with the name before it, never a threshold or a budget", async () => {
        const subject = await build()

        const items = subject.pricedItemsOf(SALES_KNOWLEDGE)

        expect(new Set(items.map((item) => `${item.name}=${item.priceVnd}`))).toEqual(
            new Set(["gi\u1ecf hoa nh\u1ecf=3500000", "gi\u1ecf hoa l\u1edbn=17500000"]),
        )
    })

    it("keeps a code name whole, its digits never read as a price", async () => {
        const subject = await build()

        expect(subject.pricedItemsOf(SKU_KNOWLEDGE)).toEqual([
            { name: "uat-ae-20261103-62a985-gi\u1ecf-hoa-nh\u1ecf", priceVnd: 3_500_000 },
            { name: "uat-ae-20261103-62a985-gi\u1ecf-hoa-l\u1edbn", priceVnd: 17_500_000 },
        ])
    })

    it("reads millions and thousands, and drops a zero, a small number and an empty knowledge", async () => {
        const subject = await build()

        expect(
            subject.pricedItemsOf(
                "C\u1ee1 v\u1eeba 2,2 tri\u1ec7u; b\u00f3 hoa h\u1ed3ng 650 ngh\u00ecn; thi\u1ec7p 0k; ghim 0.001; 12 b\u00f4ng",
            ),
        ).toEqual([
            { name: "C\u1ee1 v\u1eeba", priceVnd: 2_200_000 },
            { name: "b\u00f3 hoa h\u1ed3ng", priceVnd: 650_000 },
        ])
        expect(subject.pricedItemsOf(null)).toEqual([])
    })
})

describe("nameBefore", () => {
    it.each([
        ["the clause after the last break", "giao mi\u1ec5n ph\u00ed, gi\u1ecf hoa nh\u1ecf ", "gi\u1ecf hoa nh\u1ecf"],
        ["the words after a colon", "- Gi\u00e1 tr\u1ecdn g\u00f3i: gi\u1ecf hoa nh\u1ecf ", "gi\u1ecf hoa nh\u1ecf"],
        ["the words before a colon that ends the clause", "gi\u1ecf hoa nh\u1ecf: ", "gi\u1ecf hoa nh\u1ecf"],
        [
            "a name without the words that lead to its price",
            "gi\u1ecf hoa l\u1edbn c\u00f3 gi\u00e1 ",
            "gi\u1ecf hoa l\u1edbn",
        ],
        ["a name with no break at all", "Combo th\u01b0 gi\u00e3n ", "Combo th\u01b0 gi\u00e3n"],
        ["nothing for a threshold", "\u0110\u01a1n h\u00e0ng t\u1eeb ", ""],
        ["nothing for a stray letter", "; x ", ""],
    ])("reads %s", async (_label, text, name) => {
        const subject = await build()

        expect(subject.nameBefore(text)).toBe(name)
    })
})

describe("orderInMessage", () => {
    it("records the r28 probe's one small basket at its written price, whatever the model said", async () => {
        const subject = await build()

        expect(
            subject.orderInMessage(
                SALES_KNOWLEDGE,
                "Ch\u00e0o em, anh l\u00e0 Lan, s\u1ed1 0901234567. Anh mu\u1ed1n \u0111\u1eb7t 1 gi\u1ecf uat-ae-20261103-62a985-gi\u1ecf-hoa-nh\u1ecf gi\u00e1 3.500.000 \u0111\u1ed3ng, giao trong tu\u1ea7n n\u00e0y.",
            ),
        ).toEqual({ items: "gi\u1ecf hoa nh\u1ecf", amountVnd: 3_500_000 })
    })

    it("records the r28 probe's five small baskets as the count times the written price", async () => {
        const subject = await build()

        expect(
            subject.orderInMessage(
                SALES_KNOWLEDGE,
                "Ch\u00e0o em, anh l\u00e0 Minh, s\u1ed1 0907654321. Anh \u0111\u1eb7t 5 gi\u1ecf uat-ae-20261103-62a985-gi\u1ecf-hoa-nh\u1ecf, t\u1ed5ng 17.500.000 \u0111\u1ed3ng, x\u00e1c nh\u1eadn \u0111\u01a1n gi\u00fap anh.",
            ),
        ).toEqual({ items: "5 \u00d7 gi\u1ecf hoa nh\u1ecf", amountVnd: 17_500_000 })
    })

    it("records flow D's one catalogue item under its own name, the shorter names inside it not a second item", async () => {
        const subject = await build()

        expect(
            subject.orderInMessage(
                `${SKU_KNOWLEDGE}\n- gi\u1ecf-hoa-nh\u1ecf: 3.500.000 \u0111\u1ed3ng`,
                "M\u00ecnh l\u00e0 uat-ae-20261103-62a985-3500000, m\u00ecnh x\u00e1c nh\u1eadn \u0111\u1eb7t mua \u0111\u00fang m\u1ed9t uat-ae-20261103-62a985-gi\u1ecf-hoa-nh\u1ecf theo gi\u00e1 tr\u1ecdn g\u00f3i trong danh m\u1ee5c \u0111\u00e3 c\u00f4ng b\u1ed1. M\u00ecnh ch\u01b0a thanh to\u00e1n.",
            ),
        ).toEqual({ items: "uat-ae-20261103-62a985-gi\u1ecf-hoa-nh\u1ecf", amountVnd: 3_500_000 })
    })

    it("adds up two items in the order the customer named them, each with its own count", async () => {
        const subject = await build()

        expect(
            subject.orderInMessage(
                SALES_KNOWLEDGE,
                "L\u1ea5y gi\u1ecf hoa l\u1edbn, th\u00eam 2 gi\u1ecf hoa nh\u1ecf nh\u00e9",
            ),
        ).toEqual({
            items: "gi\u1ecf hoa l\u1edbn, 2 \u00d7 gi\u1ecf hoa nh\u1ecf",
            amountVnd: 24_500_000,
        })
    })

    it.each([
        ["a question with no buying verb", "Gi\u1ecf hoa nh\u1ecf gi\u00e1 bao nhi\u00eau?"],
        ["a refused purchase", "Anh kh\u00f4ng mu\u1ed1n mua gi\u1ecf hoa nh\u1ecf n\u1eefa"],
        ["a purchase of nothing the knowledge prices", "Anh mu\u1ed1n \u0111\u1eb7t hoa sinh nh\u1eadt"],
        ["a count of zero", "\u0110\u1eb7t 0 gi\u1ecf hoa nh\u1ecf"],
    ])("places no order for %s", async (_label, message) => {
        const subject = await build()

        expect(subject.orderInMessage(SALES_KNOWLEDGE, message)).toBeNull()
    })

    it("places no order for a name the owner wrote at two prices, nor with no knowledge", async () => {
        const subject = await build()

        expect(subject.orderInMessage("Combo A 500k. Combo A 700k.", "Mua Combo A")).toBeNull()
        expect(subject.orderInMessage(null, "Mua gi\u1ecf hoa nh\u1ecf")).toBeNull()
    })

    it("keeps one of a name written twice at the same price", async () => {
        const subject = await build()

        expect(subject.orderInMessage("Combo A 500k. Combo A 500k.", "Order 3 Combo A")).toEqual({
            items: "3 \u00d7 Combo A",
            amountVnd: 1_500_000,
        })
    })
})
