import { Test } from "@nestjs/testing"
import type { OrderRow } from "@nivo-lite/blocks-core/modules/sales"
import {
    OPEN_ORDER,
    isRecordId as realIsRecordId,
    payloadOf as realPayloadOf,
    pricedFromCatalogue,
    standsFor,
    textOrNull,
} from "./sales-effects.policy"
import { confirmSchema } from "./sales-effects.schema"

const SUBJECT = Symbol("sales-effects.policy")

interface Subject {
    readonly isRecordId: typeof realIsRecordId
    readonly payloadOf: typeof realPayloadOf
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isRecordId: realIsRecordId, payloadOf: realPayloadOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("the policy of the Sales effects", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it("tells a record id from any other text", () => {
        expect(subject.isRecordId("11111111-1111-4111-8111-111111111111")).toBe(true)
        expect(subject.isRecordId("lead-1")).toBe(false)
    })

    it("reads a payload under the schema of its effect", () => {
        expect(subject.payloadOf(confirmSchema, { orderId: "o-1", extra: 1 })).toEqual({ orderId: "o-1" })
    })

    it("refuses a payload that is not what the effect asks for", () => {
        expect(() => subject.payloadOf(confirmSchema, { orderId: "" })).toThrow("SALES_EFFECTS_INVALID_PAYLOAD")
    })
})

const LINE = { name: "tea", qty: 2, unitVnd: 50_000, amountVnd: 100_000 }
const REQUEST = {
    lines: [LINE],
    amountVnd: 100_000,
    note: "",
    deliveryAddress: "25 Nguyen Hue",
    recipientName: "Lan",
    recipientPhone: "0901 234 567",
    deliveryAt: "thứ Bảy 9-11h",
}
type Standing = Pick<
    OrderRow,
    "status" | "items" | "amountVnd" | "note" | "deliveryAddress" | "recipientName" | "recipientPhone" | "deliveryAt"
>
const orderWith = (over: Partial<Standing>): Standing => ({
    status: "confirmed",
    items: { lines: [LINE] },
    amountVnd: 100_000,
    note: "",
    deliveryAddress: "25 Nguyen Hue",
    recipientName: "Lan",
    recipientPhone: "0901 234 567",
    deliveryAt: "thứ Bảy 9-11h",
    ...over,
})

describe("whether an open order stands for a request", () => {
    it("names the open statuses: a draft and a confirmed order", () => {
        expect(OPEN_ORDER).toEqual(["draft", "confirmed"])
    })

    it.each<Standing["status"]>(["draft", "confirmed"])(
        "is true for a %s order with the same lines, total, note, address, recipient and delivery time",
        (status) => {
            expect(standsFor(orderWith({ status }), REQUEST)).toBe(true)
        },
    )

    it.each([
        ["a paid order", orderWith({ status: "paid" })],
        ["a cancelled order", orderWith({ status: "cancelled" })],
        ["another total", orderWith({ amountVnd: 1 })],
        ["another note", orderWith({ note: "elsewhere" })],
        ["another recipient phone", orderWith({ recipientPhone: "0912 000 000" })],
        ["another recipient", orderWith({ recipientName: "Mai" })],
        ["another address", orderWith({ deliveryAddress: "1 Le Loi" })],
        ["no delivery time", orderWith({ deliveryAt: null })],
        ["fewer lines", orderWith({ items: { lines: [] } })],
        ["another name", orderWith({ items: { lines: [{ ...LINE, name: "cake" }] } })],
        ["another quantity", orderWith({ items: { lines: [{ ...LINE, qty: 3 }] } })],
        ["another price", orderWith({ items: { lines: [{ ...LINE, unitVnd: 1 }] } })],
        ["another line amount", orderWith({ items: { lines: [{ ...LINE, amountVnd: 1 }] } })],
    ])("is false for %s", (_label, order) => {
        expect(standsFor(order, REQUEST)).toBe(false)
    })
})

describe("pricing an order from the catalogue", () => {
    const catalogue = [
        { id: "i-tea", name: "Trà sen", priceVnd: 40_000, active: true },
        { id: "i-vase", name: "Vase", priceVnd: null, active: true },
        { id: "i-old", name: "Old basket", priceVnd: 10_000, active: false },
    ]

    it("takes the name and the price of the catalogue item, found by id, else by name without accents or case", () => {
        expect(
            pricedFromCatalogue(
                [
                    { catalogueItemId: "i-tea", qty: 2 },
                    { name: " tra  SEN ", qty: 1.5 },
                ],
                catalogue,
            ),
        ).toEqual({
            lines: [
                { name: "Trà sen", qty: 2, unitVnd: 40_000, amountVnd: 80_000 },
                { name: "Trà sen", qty: 1.5, unitVnd: 40_000, amountVnd: 60_000 },
            ],
        })
    })

    it("refuses the whole request at the first item it cannot price, naming it", () => {
        expect(pricedFromCatalogue([{ name: "orchid", qty: 1 }], catalogue)).toEqual({
            refused: "item_unknown",
            name: "orchid",
        })
        expect(pricedFromCatalogue([{ name: "old basket", qty: 1 }], catalogue)).toEqual({
            refused: "item_unknown",
            name: "old basket",
        })
        expect(pricedFromCatalogue([{ catalogueItemId: "i-vase", qty: 1 }], catalogue)).toEqual({
            refused: "item_unpriced",
            name: "Vase",
        })
        expect(pricedFromCatalogue([{ qty: 1 }], catalogue)).toEqual({ refused: "item_unknown", name: "" })
    })

    it("keeps the recipient phone and the delivery time trimmed, and none when blank or absent", () => {
        expect(textOrNull(" 0901 234 567 ")).toBe("0901 234 567")
        expect(textOrNull("  ")).toBeNull()
        expect(textOrNull(undefined)).toBeNull()
    })
})
