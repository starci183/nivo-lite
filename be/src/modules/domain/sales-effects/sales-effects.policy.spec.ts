import { Test } from "@nestjs/testing"
import type { OrderRow } from "@nivo-lite/blocks-core/modules/sales"
import { OPEN_ORDER, isRecordId as realIsRecordId, payloadOf as realPayloadOf, standsFor } from "./sales-effects.policy"
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
const REQUEST = { lines: [LINE], amountVnd: 100_000, note: "25 Nguyen Hue" }
type Standing = Pick<OrderRow, "status" | "items" | "amountVnd" | "note">
const orderWith = (over: Partial<Standing>): Standing => ({
    status: "confirmed",
    items: { lines: [LINE] },
    amountVnd: 100_000,
    note: "25 Nguyen Hue",
    ...over,
})

describe("whether an open order stands for a request", () => {
    it("names the open statuses: a draft and a confirmed order", () => {
        expect(OPEN_ORDER).toEqual(["draft", "confirmed"])
    })

    it.each<Standing["status"]>(["draft", "confirmed"])(
        "is true for a %s order with the same lines, total and note",
        (status) => {
            expect(standsFor(orderWith({ status }), REQUEST)).toBe(true)
        },
    )

    it.each([
        ["a paid order", orderWith({ status: "paid" })],
        ["a cancelled order", orderWith({ status: "cancelled" })],
        ["another total", orderWith({ amountVnd: 1 })],
        ["another note", orderWith({ note: "elsewhere" })],
        ["fewer lines", orderWith({ items: { lines: [] } })],
        ["another name", orderWith({ items: { lines: [{ ...LINE, name: "cake" }] } })],
        ["another quantity", orderWith({ items: { lines: [{ ...LINE, qty: 3 }] } })],
        ["another price", orderWith({ items: { lines: [{ ...LINE, unitVnd: 1 }] } })],
        ["another line amount", orderWith({ items: { lines: [{ ...LINE, amountVnd: 1 }] } })],
    ])("is false for %s", (_label, order) => {
        expect(standsFor(order, REQUEST)).toBe(false)
    })
})
