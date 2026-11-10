import { messageOrderShape } from "../../entities/chat/message-media.shape"
import { orderCardOf, orderCardWithPhotos } from "./order-card.policy"

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
                    unitText: "2.000 ₫",
                    amountText: "2.000 ₫",
                    imageUrl: "https://api/p/1/image",
                },
                { name: "Chau la", qty: 2 },
            ],
            amountText: "2.000 ₫",
            address: "25 Nguyen Hue",
            paid: true,
        })
        expect(messageOrderShape.safeParse(card).success).toBe(true)
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
