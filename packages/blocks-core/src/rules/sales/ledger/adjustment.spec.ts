import { normalizeAdjustment } from "./adjustment"
import type { AdjustmentRequest } from "./adjustment"

const request: AdjustmentRequest = { targetType: "invoice", targetId: "t1", note: "  Discount   agreed  " }

describe("adjustment", () => {
    it("tidies the note and rounds the amount to a whole dong", () => {
        expect(normalizeAdjustment({ ...request, correctedAmount: 1_800_000.4 })).toEqual({
            ok: true,
            adjustment: {
                targetType: "invoice",
                targetId: "t1",
                note: "Discount agreed",
                correctedAmountVnd: 1_800_000,
            },
        })
    })

    it("takes a note alone, whether the amount is null or left out", () => {
        const left = normalizeAdjustment(request)
        const nulled = normalizeAdjustment({ ...request, correctedAmount: null })
        expect(left).toEqual(nulled)
        expect(left.ok && left.adjustment.correctedAmountVnd).toBeNull()
    })

    it("refuses a note that is too short or too long once tidied", () => {
        expect(normalizeAdjustment({ ...request, note: "  ok  " })).toEqual({ ok: false, reason: "note_length" })
        expect(normalizeAdjustment({ ...request, note: "x".repeat(1001) })).toEqual({
            ok: false,
            reason: "note_length",
        })
        expect(normalizeAdjustment({ ...request, note: "x".repeat(1000) }).ok).toBe(true)
    })

    it("refuses a negative amount and an amount that is no whole number", () => {
        expect(normalizeAdjustment({ ...request, correctedAmount: -1 })).toEqual({
            ok: false,
            reason: "amount_invalid",
        })
        expect(normalizeAdjustment({ ...request, correctedAmount: Number.NaN })).toEqual({
            ok: false,
            reason: "amount_invalid",
        })
        expect(normalizeAdjustment({ ...request, correctedAmount: 0 }).ok).toBe(true)
    })
})
