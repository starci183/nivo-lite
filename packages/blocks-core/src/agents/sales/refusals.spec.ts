import { CONFLICT, refusedWith, waitsForOwnerResult, writeRefusal } from "./refusals"

describe("the refusals of the Sales module", () => {
    it("carries a domain refusal as data with a message key of the module", () => {
        expect(refusedWith("same_stage")).toEqual({
            ok: false,
            reason: "refused",
            message: { key: "refusal_same_stage" },
        })
    })

    it("answers a lost race as a conflict", () => {
        expect(CONFLICT).toEqual({ ok: false, reason: "conflict", message: { key: "refusal_conflict" } })
    })

    it("answers an order that waits for the owner with the threshold as data", () => {
        expect(waitsForOwnerResult(5_000_000)).toEqual({
            ok: false,
            reason: "refused",
            message: { key: "refusal_order_waits_owner" },
            data: { waiting: true, thresholdVnd: 5_000_000 },
        })
    })

    it("answers a write the engine did not make as missing when the record is gone and as a conflict otherwise", () => {
        expect(writeRefusal({ ok: false, reason: "missing" })).toEqual(refusedWith("missing"))
        expect(writeRefusal({ ok: false, reason: "stale" })).toEqual(CONFLICT)
    })
})
