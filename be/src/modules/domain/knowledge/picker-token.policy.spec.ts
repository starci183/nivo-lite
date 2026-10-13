import { isPickerToken } from "./picker-token.policy"

describe("isPickerToken", () => {
    it("accepts a token made of the characters Google tokens use", () => {
        expect(isPickerToken("ya29.a0AfH6SMB-xyz_123~+/=abcdef")).toBe(true)
    })

    it("refuses a token that is too short, too long or made of other characters", () => {
        expect(isPickerToken("short")).toBe(false)
        expect(isPickerToken("a".repeat(4097))).toBe(false)
        expect(isPickerToken(`${"a".repeat(30)} <script>`)).toBe(false)
    })
})
