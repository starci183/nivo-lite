import { refusal, writeRefusal } from "./refusal"

describe("refusal", () => {
    it("carries the reason and the words of the key", () => {
        expect(refusal("conflict", "handling_conflict")).toEqual({
            ok: false,
            reason: "conflict",
            message: { key: "handling_conflict" },
        })
    })
})

describe("writeRefusal", () => {
    it("says the conversation is gone when the engine found no record", () => {
        expect(writeRefusal({ ok: false, reason: "missing" })).toEqual({
            ok: false,
            reason: "refused",
            message: { key: "reply_not_found" },
        })
    })

    it("says the conversation just changed for a version that moved or any other refusal", () => {
        const changed = { ok: false, reason: "conflict", message: { key: "handling_conflict" } }
        expect(writeRefusal({ ok: false, reason: "stale" })).toEqual(changed)
        expect(writeRefusal({ ok: false, reason: "invalid" })).toEqual(changed)
    })
})
