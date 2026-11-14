import { EFFECT_REFUSED, isRefusal, refusalOf } from "./effect-facts"

describe("effect facts", () => {
    it("a refusal names its reason and carries the true values that explain it", () => {
        const refusal = refusalOf("no_post_right", { room: "common" })
        expect(refusal).toEqual({ kind: EFFECT_REFUSED, id: "no_post_right", facts: { room: "common" } })
        expect(isRefusal(refusal)).toBe(true)
    })

    it("a subject that is not a refusal is not read as one", () => {
        expect(isRefusal({ kind: "order", id: "o1" })).toBe(false)
    })
})
