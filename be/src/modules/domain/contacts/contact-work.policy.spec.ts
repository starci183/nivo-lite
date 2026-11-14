import { roundOfItemKey, STEP_ENTRY_KINDS } from "./contact-work.policy"

describe("roundOfItemKey", () => {
    it("reads the round back from the engine's round key", () => {
        expect(roundOfItemKey("r1")).toBe(1)
        expect(roundOfItemKey("r12")).toBe(12)
    })

    it("is null for a step outside every loop and for an item that is no round (a for-each element)", () => {
        expect(roundOfItemKey(null)).toBeNull()
        expect(roundOfItemKey("")).toBeNull()
        expect(roundOfItemKey("item-3")).toBeNull()
        expect(roundOfItemKey("r")).toBeNull()
        expect(roundOfItemKey("r0")).toBeNull()
        expect(roundOfItemKey("r01")).toBeNull()
        expect(roundOfItemKey("r1x")).toBeNull()
        expect(roundOfItemKey("r-2")).toBeNull()
        expect(roundOfItemKey("R2")).toBeNull()
    })
})

describe("STEP_ENTRY_KINDS", () => {
    it("holds the three ways a step ends and neither the trigger nor the facts entry", () => {
        expect(STEP_ENTRY_KINDS).toEqual(["done", "failed", "passed_over"])
    })
})
