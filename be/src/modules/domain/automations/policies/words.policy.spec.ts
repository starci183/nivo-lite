import { NEUTRAL_VARIABLES, SAMPLE_VARIABLES } from "./words.policy"

describe("variable lists", () => {
    it("names the variables a blank reads as a neutral word", () => {
        expect(NEUTRAL_VARIABLES).toContain("ten_khach")
        expect(new Set(NEUTRAL_VARIABLES).size).toBe(NEUTRAL_VARIABLES.length)
    })

    it("names the variables a preview fills with a sample", () => {
        expect(SAMPLE_VARIABLES).toContain("tom_tat")
        expect(new Set(SAMPLE_VARIABLES).size).toBe(SAMPLE_VARIABLES.length)
    })
})
