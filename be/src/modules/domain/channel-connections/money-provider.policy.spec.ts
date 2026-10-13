import { isZaloAppId } from "./money-provider.policy"

describe("isZaloAppId", () => {
    it("accepts six to thirty digits and refuses other app identifiers", () => {
        expect(isZaloAppId("123456")).toBe(true)
        expect(isZaloAppId("1".repeat(30))).toBe(true)
        expect(isZaloAppId("12345")).toBe(false)
        expect(isZaloAppId("1".repeat(31))).toBe(false)
        expect(isZaloAppId("app123456")).toBe(false)
    })
})
