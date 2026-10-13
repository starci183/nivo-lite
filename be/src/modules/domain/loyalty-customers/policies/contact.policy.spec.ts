import { toLoyaltyEmail, toLoyaltyPhone } from "./contact.policy"

describe("contact.policy", () => {
    describe("toLoyaltyPhone", () => {
        it("turns the usual ways of writing one number into the 84 form", () => {
            expect(toLoyaltyPhone("0912 345 678")).toBe("84912345678")
            expect(toLoyaltyPhone("+84 912 345 678")).toBe("84912345678")
            expect(toLoyaltyPhone("0084912345678")).toBe("84912345678")
            expect(toLoyaltyPhone("912345678")).toBe("84912345678")
            expect(toLoyaltyPhone("84912345678")).toBe("84912345678")
        })

        it("accepts a landline of ten digits after the country code", () => {
            expect(toLoyaltyPhone("02838123456")).toBe("842838123456")
        })

        it("answers null for anything that is not a plausible number", () => {
            expect(toLoyaltyPhone(null)).toBeNull()
            expect(toLoyaltyPhone("")).toBeNull()
            expect(toLoyaltyPhone("abc")).toBeNull()
            expect(toLoyaltyPhone("12345")).toBeNull()
            expect(toLoyaltyPhone("1234567890123")).toBeNull()
        })
    })

    describe("toLoyaltyEmail", () => {
        it("lower-cases and trims an address", () => {
            expect(toLoyaltyEmail("  Anna@Example.COM ")).toBe("anna@example.com")
        })

        it("answers null for text that is not an address", () => {
            expect(toLoyaltyEmail("anna")).toBeNull()
            expect(toLoyaltyEmail("")).toBeNull()
            expect(toLoyaltyEmail(null)).toBeNull()
        })
    })
})
