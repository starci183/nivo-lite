import { outcomeOf } from "./outcome"

const MESSAGE = { key: "m" } as const

describe("outcomeOf", () => {
    it("maps success with and without data", () => {
        expect(outcomeOf({ ok: true })).toEqual({ ok: true })
        expect(outcomeOf({ ok: true, data: { id: "h1" } })).toEqual({ ok: true, data: { id: "h1" } })
    })

    it("maps invalid with its fields, or none", () => {
        expect(outcomeOf({ ok: false, reason: "invalid", message: MESSAGE, fields: { name: { key: "f" } } })).toEqual({
            ok: false,
            reason: "invalid",
            fields: { name: { key: "f" } },
            message: MESSAGE,
        })
        expect(outcomeOf({ ok: false, reason: "invalid", message: MESSAGE })).toEqual({
            ok: false,
            reason: "invalid",
            fields: {},
            message: MESSAGE,
        })
    })

    it("maps a domain refusal with its data", () => {
        const nearest = { taken: "10:00", nearest: ["10:30", "11:00"] }
        expect(outcomeOf({ ok: false, reason: "refused", message: MESSAGE, data: nearest })).toEqual({
            ok: false,
            reason: "refused",
            message: MESSAGE,
            data: nearest,
        })
    })

    it.each(["forbidden", "conflict", "failed"] as const)("maps %s with its message and no data", (reason) => {
        expect(outcomeOf({ ok: false, reason, message: MESSAGE })).toEqual({ ok: false, reason, message: MESSAGE })
    })
})
