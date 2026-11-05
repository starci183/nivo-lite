import { INITIAL_GATE, gateReducer, gatedSlot, isAnswered, isGated, isSettled } from "./view-gate"

describe("isAnswered", () => {
    it("is false only for a loading slot", () => {
        expect(isAnswered({ isLoading: true })).toBe(false)
        expect(isAnswered({ isError: true })).toBe(true)
        expect(isAnswered({ isForbidden: true })).toBe(true)
        expect(isAnswered({ isEmpty: true })).toBe(true)
        expect(isAnswered({ items: [1] })).toBe(true)
    })
})

describe("the view gate", () => {
    it("is not settled and not gated before any read reports", () => {
        expect(isSettled(INITIAL_GATE.answers)).toBe(false)
        expect(isGated(INITIAL_GATE)).toBe(false)
    })

    it("gates while any reported read has not answered, and settles when all have", () => {
        const a = gateReducer(INITIAL_GATE, { kind: "report", key: "a.rows", isAnswered: true })
        const b = gateReducer(a, { kind: "report", key: "b.rows", isAnswered: false })
        expect(isGated(b)).toBe(true)
        expect(isSettled(b.answers)).toBe(false)
        const c = gateReducer(b, { kind: "report", key: "b.rows", isAnswered: true })
        expect(isGated(c)).toBe(false)
        expect(isSettled(c.answers)).toBe(true)
    })

    it("keeps the same state when a report changes nothing", () => {
        const a = gateReducer(INITIAL_GATE, { kind: "report", key: "a", isAnswered: false })
        expect(gateReducer(a, { kind: "report", key: "a", isAnswered: false })).toBe(a)
    })

    it("forgets a read that left, and ignores one it never saw", () => {
        const a = gateReducer(INITIAL_GATE, { kind: "report", key: "a", isAnswered: false })
        const b = gateReducer(a, { kind: "report", key: "b", isAnswered: true })
        expect(gateReducer(b, { kind: "forget", key: "a" }).answers).toEqual({ b: true })
        expect(gateReducer(b, { kind: "forget", key: "zzz" })).toBe(b)
    })

    it("opens once and never gates again, however the reads move", () => {
        const a = gateReducer(INITIAL_GATE, { kind: "report", key: "a", isAnswered: true })
        const opened = gateReducer(a, { kind: "open" })
        expect(opened.isOpened).toBe(true)
        expect(gateReducer(opened, { kind: "open" })).toBe(opened)
        const reloading = gateReducer(opened, { kind: "report", key: "a", isAnswered: false })
        expect(isGated(reloading)).toBe(false)
    })

    it("draws the skeleton for every slot while gated and the slot itself otherwise", () => {
        expect(gatedSlot(true, { items: [1] })).toEqual({ isLoading: true })
        expect(gatedSlot(false, { items: [1] })).toEqual({ items: [1] })
    })
})
