import { runNode } from "@nivo-lite/agent-sdk/node"
import type { NodeModelRequest } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts, nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import { coreEffects } from "../../vocabulary/effects"
import { CLASSIFY_INSTRUCTIONS } from "./classify.messages"
import { intentClassifyNode } from "./classify.node"
import { modelReplySchema } from "./classify.schema"
import { addressInWords, classificationOf, imagesOf, messagesOf, vndOf } from "./classify.policy"
import { sampleOf } from "../../messages/catalog"

describe("intent.classify", () => {
    it.each(intentClassifyNode.examples.map((each) => [each.name, each] as const))(
        "example: %s",
        async (_name, each) => {
            await expect(nodeExampleMismatches(intentClassifyNode, each, coreEffects)).resolves.toEqual([])
        },
    )
})

describe("the instructions of the classification", () => {
    it("tell the model that the words after a delivery word are the address", () => {
        expect(CLASSIFY_INSTRUCTIONS).toContain("giao")
        expect(CLASSIFY_INSTRUCTIONS).toContain(sampleOf("sample25NguyenHue"))
    })
})

describe("messagesOf", () => {
    it("is one message per non-blank line", () => {
        expect(messagesOf(`${sampleOf("sampleMot")}\n\n  \nhai`)).toEqual([sampleOf("sampleMot"), "hai"])
    })
})

describe("vndOf", () => {
    it.each([
        [5000, 5000],
        [0, null],
        [Number.NaN, null],
        ["5k", 5000],
        ["1,5tr", 1_500_000],
        [sampleOf("sample2Trieu"), 2_000_000],
        [sampleOf("sample500Nghin"), 500_000],
        [sampleOf("sample5000d"), 5000],
        ["120000 VND", 120_000],
        [sampleOf("sampleNamNghin"), null],
        ["", null],
        [null, null],
    ])("reads %p as %p", (written, amount) => {
        expect(vndOf(written)).toBe(amount)
    })
})

const classified = (
    reply: Parameters<typeof classificationOf>[0],
    imageCount: number,
    text = "",
): ReturnType<typeof classificationOf> => classificationOf(reply, imageCount, text)

const IMG = { name: "a.jpg", contentType: "image/jpeg", url: "https://files/a.jpg" }
const PDF = { name: "a.pdf", contentType: "application/pdf", url: "https://files/a.pdf" }

describe("classificationOf", () => {
    it("cleans the slots: blank items dropped, quantity bounded, blank strings null", () => {
        const output = classified(
            {
                intents: ["order", "other", "order"],
                order: {
                    items: [
                        { name: " hoa ", quantity: 0 },
                        { name: "  ", quantity: 3 },
                        { name: sampleOf("sampleChau"), quantity: null },
                        { name: sampleOf("sampleDen"), quantity: 99_999 },
                    ],
                    address: "   ",
                    customer: " Lan ",
                },
                payment_claim: { amount_vnd: "abc", payer_name: "" },
                images: [],
            },
            0,
        )
        expect(output).toEqual({
            intents: ["order", "payment_claim"],
            order: {
                items: [
                    { name: "hoa", quantity: 1, priceVnd: null },
                    { name: sampleOf("sampleChau"), quantity: 1, priceVnd: null },
                    { name: sampleOf("sampleDen"), quantity: 10_000, priceVnd: null },
                ],
                address: null,
                customer: "Lan",
            },
            paymentClaim: { amountVnd: null, payerName: null },
            attachment: null,
        })
    })

    it("keeps an order intent whose slot is absent, and drops other beside a real intent", () => {
        expect(classified({ intents: ["other", "order"], order: null, payment_claim: null, images: [] }, 0)).toEqual({
            intents: ["order"],
            order: null,
            paymentClaim: null,
            attachment: null,
        })
    })

    it("turns every field the model left out into null, whatever the slot", () => {
        const output = classified(
            { intents: [], order: { items: [{ name: "hoa" }] }, payment_claim: {}, images: [] },
            0,
        )
        expect(output.order).toEqual({
            items: [{ name: "hoa", quantity: 1, priceVnd: null }],
            address: null,
            customer: null,
        })
        expect(output.paymentClaim).toEqual({ amountVnd: null, payerName: null })
        expect(classified({ intents: [], images: [] }, 0)).toEqual({
            intents: ["other"],
            order: null,
            paymentClaim: null,
            attachment: null,
        })
    })

    it("reads a receipt picture as a payment claim even when the model gave no claim, and keeps what it read", () => {
        expect(classified({ intents: ["other"], images: ["payment_receipt"] }, 1)).toMatchObject({
            intents: ["payment_claim"],
            paymentClaim: { amountVnd: null, payerName: null },
            attachment: null,
        })
        expect(
            classified({ intents: [], payment_claim: { amount_vnd: 5000 }, images: ["payment_receipt"] }, 1)
                .paymentClaim,
        ).toEqual({ amountVnd: 5000, payerName: null })
    })

    it("counts the pictures that are no receipt as an attachment, understood only when every one is", () => {
        expect(classified({ intents: ["question"], images: ["other", "payment_receipt", "other"] }, 3)).toMatchObject({
            intents: ["question", "payment_claim", "attachment"],
            attachment: { count: 2, understood: true },
        })
        expect(classified({ intents: [], images: ["other", "unreadable"] }, 2).attachment).toEqual({
            count: 2,
            understood: false,
        })
        expect(classified({ intents: [], images: [] }, 2).attachment).toEqual({ count: 2, understood: false })
        expect(classified({ intents: [], images: ["other"] }, 0).attachment).toBeNull()
    })
})

describe("the delivery address", () => {
    it.each([
        [sampleOf("sampleChoMinhDat1GioHoa"), sampleOf("sample25NguyenHue")],
        [sampleOf("sampleAloDatGiumDinh1Chau"), sampleOf("sample69HangXanh")],
        [sampleOf("sampleDat2ChauGiaoDen12Le"), sampleOf("sample12LeLoiHue")],
        [sampleOf("sampleMinhOXaGiaoHangToiDia"), sampleOf("sampleChoDongBaNhe")],
        ["mua 1 chau hoa\ngiao toi 7 Tran Phu", "7 Tran Phu"],
    ])("reads the address after a delivery word in %p", (text, address) => {
        expect(addressInWords(text)).toBe(address)
    })

    it("reads no address from a delivery word that names no place", () => {
        expect(addressInWords(sampleOf("sampleGiaoHangNhanhNhe"))).toBeNull()
        expect(addressInWords(sampleOf("sampleChoMinhDatChauHoa"))).toBeNull()
        expect(addressInWords(sampleOf("sampleGiaodichXongRoi"))).toBeNull()
        expect(addressInWords("giao")).toBeNull()
    })

    it.each([
        [sampleOf("sampleChoMinhDat1GioHoa"), sampleOf("sample25NguyenHue")],
        [sampleOf("sampleAloDatGiumDinh1Chau"), sampleOf("sample69HangXanh")],
    ])("fills the address the model left null from %p", (text, address) => {
        const output = classified(
            { intents: ["order"], order: { items: [{ name: "hoa" }], address: null }, images: [] },
            0,
            text,
        )
        expect(output.order?.address).toBe(address)
    })

    it("keeps the address the model gave, and takes it from another member name when it used one", () => {
        const given = classified(
            { intents: ["order"], order: { items: [], address: sampleOf("sample1LeLoi") }, images: [] },
            0,
            sampleOf("sampleGiao25NguyenHue"),
        )
        expect(given.order?.address).toBe(sampleOf("sample1LeLoi"))
        const aliased = classified(
            {
                intents: ["order"],
                order: { items: [], delivery_address: sampleOf("sample9HangBai"), location: 5 },
                images: [],
            },
            0,
            sampleOf("sampleDatHoa"),
        )
        expect(aliased.order?.address).toBe(sampleOf("sample9HangBai2"))
    })

    it("makes an order slot of the address alone when the model named the order but gave no slot", () => {
        expect(
            classified({ intents: ["order"], images: [] }, 0, sampleOf("sampleDatHoaGiao25NguyenHue")).order,
        ).toEqual({
            items: [],
            address: sampleOf("sample25NguyenHue"),
            customer: null,
        })
        expect(
            classified({ intents: ["question"], images: [] }, 0, sampleOf("sampleGiao25NguyenHueDuocKhong")).order,
        ).toBeNull()
        expect(classified({ intents: ["order"], images: [] }, 0, sampleOf("sampleDatHoa")).order).toBeNull()
    })

    it("lets the model's reply keep a member under another name through the schema", () => {
        const parsed = modelReplySchema.parse({
            intents: ["order"],
            order: { items: [], shipping_address: sampleOf("sample3TranPhu") },
        })
        expect(classified(parsed, 0).order?.address).toBe(sampleOf("sample3TranPhu"))
    })

    it("asks the model for the exact member names, the address included", () => {
        expect(CLASSIFY_INSTRUCTIONS).toContain('"address": string|null')
    })
})

describe("imagesOf", () => {
    it("lists the pictures of the burst in order and leaves other files out", () => {
        expect(imagesOf(null)).toEqual([])
        expect(
            imagesOf([
                { text: "a", attachments: [IMG, PDF] },
                { text: "b", attachments: [] },
                { text: "c", attachments: [{ ...IMG, url: "https://files/c.jpg" }] },
            ]).map((file) => file.url),
        ).toEqual(["https://files/a.jpg", "https://files/c.jpg"])
    })
})

describe("what intent.classify shows the model", () => {
    const askOf = async (messages: Array<{ text: string; attachments: Array<typeof IMG> }> | null) => {
        const fake = fakeNodePorts()
        const asks: Array<NodeModelRequest> = []
        await runNode(
            {
                node: intentClassifyNode,
                params: {},
                input: { text: sampleOf("sampleAnh"), messages },
                turn: EXAMPLE_TURN,
                grant: { rights: [] },
                effects: new Map(),
                tools: new Map(),
                key: "k",
            },
            {
                ...fake.ports,
                model: {
                    text: () => Promise.reject(new Error("no text")),
                    json: (schema, ask) => {
                        asks.push(ask)
                        return Promise.resolve(schema.parse({ intents: ["other"] }))
                    },
                },
            },
        )
        return asks[0]
    }

    it("gives the pictures as addresses, at most four, and the words without them", async () => {
        const many = Array.from({ length: 6 }, (_, index) => ({ ...IMG, url: `https://files/${index}.jpg` }))
        const ask = await askOf([{ text: sampleOf("sampleAnh"), attachments: [...many, PDF] }])
        expect(ask?.images).toEqual(many.slice(0, 4).map((file) => file.url))
        expect(ask?.input).toEqual({ messages: [sampleOf("sampleAnh")] })
    })

    it("gives no picture when the burst has none", async () => {
        expect((await askOf(null))?.images).toEqual([])
    })
})
