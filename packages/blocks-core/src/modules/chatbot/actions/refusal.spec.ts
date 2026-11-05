import { refusal } from "./refusal"

describe("refusal", () => {
    it("carries the reason and the words of the key", () => {
        expect(refusal("conflict", "handling_conflict")).toEqual({
            ok: false,
            reason: "conflict",
            message: { key: "handling_conflict" },
        })
    })
})
