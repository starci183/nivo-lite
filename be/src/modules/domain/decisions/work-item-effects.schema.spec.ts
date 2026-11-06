import { raisePayloadSchema, undoPayloadSchema } from "./work-item-effects.schema"

/** A record of `count` members, each holding `value`. */
const membersOf = (count: number, value: unknown): Record<string, unknown> =>
    Object.fromEntries(Array.from({ length: count }, (_unused, index) => [`k${String(index)}`, value]))

describe("work-item-effects.schema", () => {
    it("reads a raise payload with members of every JSON kind, its amount optional", () => {
        const payload = { text: "x", amount: 5, paid: false, none: null, list: [1, "a"], nested: { a: [{ b: 1 }] } }

        expect(raisePayloadSchema.safeParse({ action: "review", title: "Review", payload }).success).toBe(true)
        expect(
            raisePayloadSchema.safeParse({
                action: "review",
                title: "Review",
                payload: {},
                amountVnd: 0,
            }).success,
        ).toBe(true)
    })

    it("refuses a negative amount, an empty title, and a payload, nested object or list over 500 members", () => {
        const raise = (payload: unknown, extra: object = {}) =>
            raisePayloadSchema.safeParse({ action: "review", title: "Review", payload, ...extra }).success

        expect(raise({}, { amountVnd: -1 })).toBe(false)
        expect(raise({}, { title: "" })).toBe(false)
        expect(raise(membersOf(501, 1))).toBe(false)
        expect(raise({ nested: membersOf(501, 1) })).toBe(false)
        expect(raise({ list: Array(501).fill(1) })).toBe(false)
    })

    it("reads an undo that names one record, and refuses one with no id", () => {
        expect(undoPayloadSchema.safeParse({ id: "o-1" }).success).toBe(true)
        expect(undoPayloadSchema.safeParse({ id: "" }).success).toBe(false)
    })
})
