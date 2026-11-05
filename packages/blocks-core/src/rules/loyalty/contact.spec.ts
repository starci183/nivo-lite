import { customerBirthday, toLoyaltyPhone } from "./contact"

describe("toLoyaltyPhone", () => {
    it.each([
        ["0912 345 678", "84912345678"],
        ["+84 912 345 678", "84912345678"],
        ["0084912345678", "84912345678"],
        ["912345678", "84912345678"],
        ["84912345678", "84912345678"],
    ])("writes %s as %s", (raw, expected) => {
        expect(toLoyaltyPhone(raw)).toBe(expected)
    })

    it("refuses what is not a plausible number", () => {
        expect(toLoyaltyPhone(null)).toBeNull()
        expect(toLoyaltyPhone("")).toBeNull()
        expect(toLoyaltyPhone("12345")).toBeNull()
    })
})

describe("customerBirthday", () => {
    it("keeps a real calendar day", () => {
        expect(customerBirthday("1990-02-28")).toBe("1990-02-28")
    })

    it("drops an empty, malformed or impossible day", () => {
        expect(customerBirthday(null)).toBeNull()
        expect(customerBirthday("20/11/1990")).toBeNull()
        expect(customerBirthday("1990-02-30")).toBeNull()
        expect(customerBirthday("1990-13-01")).toBeNull()
    })
})
