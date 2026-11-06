import { contactParts, normaliseContact, phoneInText } from "./contact"

describe("normaliseContact", () => {
    it("gives nothing for a blank or missing contact", () => {
        expect(normaliseContact(null)).toBeNull()
        expect(normaliseContact(undefined)).toBeNull()
        expect(normaliseContact("   ")).toBeNull()
    })

    it("lowercases an email", () => {
        expect(normaliseContact(" An@Example.COM ")).toBe("an@example.com")
    })

    it("gives nothing for text with no digit", () => {
        expect(normaliseContact("call me")).toBeNull()
    })

    it("turns a leading zero into the country code", () => {
        expect(normaliseContact("0912 000 701")).toBe("84912000701")
    })

    it("adds the country code to a nine digit number", () => {
        expect(normaliseContact("912000701")).toBe("84912000701")
    })

    it("keeps a number that already has the country code, and any other length", () => {
        expect(normaliseContact("84912000701")).toBe("84912000701")
        expect(normaliseContact("849120007")).toBe("849120007")
        expect(normaliseContact("12345")).toBe("12345")
    })
})

describe("contactParts", () => {
    it("splits a phone", () => {
        expect(contactParts("0912000701")).toEqual({ phone: "84912000701", email: null })
    })

    it("splits an email", () => {
        expect(contactParts("An@x.vn")).toEqual({ phone: null, email: "an@x.vn" })
    })

    it("holds nothing for nothing", () => {
        expect(contactParts("")).toEqual({ phone: null, email: null })
    })
})

describe("phoneInText", () => {
    it("finds a phone number inside a sentence and drops its separators", () => {
        expect(phoneInText("my number is 0912 000 701, call me")).toBe("0912000701")
        expect(phoneInText("call +84 912.000.701")).toBe("+84912000701")
    })

    it("gives nothing for a message with no phone number", () => {
        expect(phoneInText("two tea sets please")).toBeNull()
        expect(phoneInText("")).toBeNull()
    })

    it("does not take a short run of digits for a phone", () => {
        expect(phoneInText("order 12345")).toBeNull()
    })
})
