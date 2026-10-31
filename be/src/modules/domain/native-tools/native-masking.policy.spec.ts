import { clipped, customerMasked, emailMasked, isoOf, needsAttention } from "./native-masking.policy"

describe("clipped", () => {
    it("keeps a short text and cuts a long one with an ellipsis", () => {
        expect(clipped("short", 10)).toBe("short")
        expect(clipped("a long sentence", 8)).toBe("a long…")
    })
})

describe("customerMasked", () => {
    it("shows the first four and the last three characters of the id", () => {
        expect(customerMasked("5540123456302")).toBe("5540…302")
    })

    it("shows nothing for an id too short to hide anything, or for no id", () => {
        expect(customerMasked("1234567")).toBe("")
        expect(customerMasked("  12  ")).toBe("")
        expect(customerMasked(null)).toBe("")
    })
})

describe("emailMasked", () => {
    it("masks the local part down to its first character", () => {
        expect(emailMasked("lan.nguyen@shop.vn")).toBe("l***@shop.vn")
    })

    it("shows nothing for a text with no local part or no domain, or for none", () => {
        expect(emailMasked("@shop.vn")).toBe("")
        expect(emailMasked("no-domain")).toBe("")
        expect(emailMasked(null)).toBe("")
    })
})

describe("needsAttention", () => {
    it("is false for a connected connection with no recorded failure", () => {
        expect(needsAttention("connected", null)).toBe(false)
        expect(needsAttention("connected", "  ")).toBe(false)
    })

    it("is true when it is not connected or a failure is recorded", () => {
        expect(needsAttention("error", null)).toBe(true)
        expect(needsAttention("pending", null)).toBe(true)
        expect(needsAttention("connected", "invalid_grant")).toBe(true)
    })
})

describe("isoOf", () => {
    it("words a database instant as ISO 8601", () => {
        expect(isoOf("2026-10-30 10:12:00.123+00")).toBe("2026-10-30T10:12:00.123Z")
    })

    it("answers nothing for a text that is no instant", () => {
        expect(isoOf("soon")).toBe("")
    })
})
