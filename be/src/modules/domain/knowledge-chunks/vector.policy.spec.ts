import { toVector } from "./vector.policy"

describe("toVector", () => {
    it("writes the numbers between brackets, comma separated", () => {
        expect(toVector([0.5, -1, 2])).toBe("[0.5,-1,2]")
    })

    it("writes an empty vector as empty brackets", () => {
        expect(toVector([])).toBe("[]")
    })
})
