import { lineOrderSchema } from "@nivo-lite/agent-sdk/node"
import { lineOrderOfRow, orderCardOf, orderCardWithPhotos } from "./order-card.policy"

const items = {
    lines: [
        { name: "Gio hoa nho", qty: 1, unitVnd: 2000, amountVnd: 2000 },
        { name: "Chau la", qty: 2, unitVnd: 0, amountVnd: 0 },
    ],
}

describe("orderCardOf", () => {
    it("takes the lines, the total in words, the delivery line and whether it was paid", () => {
        const card = orderCardOf(
            { orderNo: "DH-1", amountVnd: 2000, items, address: "25 Nguyen Hue", paid: true },
            [{ name: "gio hoa nho", imageUrl: "https://api/p/1/image" }],
            "vi",
        )
        expect(card).toEqual({
            orderNo: "DH-1",
            lines: [
                {
                    name: "Gio hoa nho",
                    qty: 1,
                    unitText: "2.000 \u20ab",
                    amountText: "2.000 \u20ab",
                    imageUrl: "https://api/p/1/image",
                },
                { name: "Chau la", qty: 2 },
            ],
            amountText: "2.000 \u20ab",
            address: "25 Nguyen Hue",
            paid: true,
        })
        expect(lineOrderSchema.safeParse(card).success).toBe(true)
    })

    it("has no total while the order has no amount, and no lines for items it cannot read", () => {
        const card = orderCardOf({ orderNo: "DH-2", amountVnd: null, items: "damaged", address: "", paid: false }, [], "en")
        expect(card).toEqual({ orderNo: "DH-2", lines: [], amountText: "", address: "", paid: false })
    })
})

describe("orderCardWithPhotos", () => {
    const card = orderCardOf({ orderNo: "DH-1", amountVnd: 2000, items, address: "", paid: false }, [], "en")

    it("fills the photo of each item from the catalogue item of the same name, without accents or case", () => {
        const filled = orderCardWithPhotos(card, [
            { name: `Gi${String.fromCodePoint(0x1ecf)} hoa nh${String.fromCodePoint(0x1ecf)}`, imageUrl: "https://api/p/1/image" },
            { name: "Chau la", imageUrl: null },
        ])
        expect(filled.lines[0]?.imageUrl).toBe("https://api/p/1/image")
        expect(filled.lines[1]).not.toHaveProperty("imageUrl")
    })

    it("keeps a photo a line already has", () => {
        const withPhoto = { ...card, lines: [{ name: "Gio hoa nho", qty: 1, imageUrl: "https://own/1" }] }
        expect(orderCardWithPhotos(withPhoto, [{ name: "Gio hoa nho", imageUrl: "https://api/p/1/image" }])).toEqual(
            withPhoto,
        )
    })
})

describe("lineOrderOfRow (the card a sales step hands to the customer send)", () => {
    // The order row the engine's line media service read before the card moved here (its spec's `ORDER`).
    const ORDER = {
        orderNo: "DH-1",
        amountVnd: 2000,
        items: { lines: [{ name: "basket", qty: 1, unitVnd: 2000, amountVnd: 2000 }] },
        note: "25 Nguyen Hue",
        status: "paid",
    }

    it("is the card the engine used to build from the same record: number, lines, total, delivery and whether it is paid", () => {
        const card = lineOrderOfRow(ORDER, "vi")
        expect(card).toMatchObject({ orderNo: "DH-1", lines: [{ name: "basket", qty: 1 }], address: "25 Nguyen Hue", paid: true })
        expect(card?.amountText).toContain("2.000")
        expect(card).toEqual(
            orderCardOf({ orderNo: "DH-1", amountVnd: 2000, items: ORDER.items, address: "25 Nguyen Hue", paid: true }, [], "vi"),
        )
    })

    it("is accepted by the engine's schema of a line card and by the stored shape of the line", () => {
        const card = lineOrderOfRow(ORDER, "vi")
        expect(lineOrderSchema.safeParse(card).success).toBe(true)
        expect(lineOrderSchema.safeParse(card).success).toBe(true)
    })

    it("says not paid for any other status, and no card for a row with no order number", () => {
        expect(lineOrderOfRow({ ...ORDER, status: "open" }, "vi")?.paid).toBe(false)
        expect(lineOrderOfRow({ amountVnd: 1 }, "vi")).toBeUndefined()
        expect(lineOrderOfRow(undefined, "vi")).toBeUndefined()
    })
})
