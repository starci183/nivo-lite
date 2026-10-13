import { cleanConnectionName } from "./connection-name.policy"

describe("cleanConnectionName", () => {
    it("trims and keeps a valid name", () => {
        expect(cleanConnectionName("  Shop bot ")).toBe("Shop bot")
    })

    it("cuts a long name to 60 characters", () => {
        expect(cleanConnectionName("x".repeat(80))).toBe("x".repeat(60))
    })

    it("refuses a name shorter than two characters", () => {
        expect(cleanConnectionName(" a ")).toBeNull()
        expect(cleanConnectionName("")).toBeNull()
    })
})
