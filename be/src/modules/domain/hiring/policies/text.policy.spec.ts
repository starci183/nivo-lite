import {
    EMAIL_MAX,
    RESERVED_SLUGS,
    cleanTextList,
    clip,
    firstNumber,
    fold,
    isEmailAddress,
    isToken,
    normalizePhone,
    slugify,
} from "./text.policy"

describe("hiring text policy", () => {
    it("exposes the email limit and reserved public slugs", () => {
        expect(EMAIL_MAX).toBe(254)
        expect(RESERVED_SLUGS).toEqual(["lich", "thu", "api", "admin"])
    })

    it("trims and clips text at the requested length", () => {
        expect(clip("  abcdef  ", 3)).toBe("abc")
        expect(clip("  abc  ", 10)).toBe("abc")
        expect(clip("  abc  ", 0)).toBe("")
    })

    it("folds case, combining accents and the letter d with a stroke", () => {
        const accented = String.fromCodePoint(0x110, 0x1eb7, 0x6e, 0x67, 0x20, 0xc9)

        expect(fold(accented)).toBe("dang e")
        expect(fold(`A${String.fromCodePoint(0x301)}`)).toBe("a")
        expect(fold("CASHIER 123")).toBe("cashier 123")
    })

    it("derives bounded slugs and removes boundary dashes after clipping", () => {
        expect(slugify("  CASHIER / Floor 2026!  ")).toBe("cashier-floor-2026")
        expect(slugify("aa bb cc", 3)).toBe("aa")
        expect(slugify("x".repeat(61))).toBe("x".repeat(60))
        expect(slugify("! @ #")).toBe("")
        expect(slugify(String.fromCodePoint(0x110, 0x1eb7, 0x6e, 0x67))).toBe("dang")
    })

    it("accepts only thirty-two lower-case hexadecimal token characters", () => {
        expect(isToken("0123456789abcdef0123456789abcdef")).toBe(true)
        expect(isToken("a".repeat(31))).toBe(false)
        expect(isToken("a".repeat(33))).toBe(false)
        expect(isToken("A".repeat(32))).toBe(false)
        expect(isToken("g".repeat(32))).toBe(false)
    })

    it("accepts email shapes and rejects whitespace and excluded punctuation", () => {
        expect(isEmailAddress("person+tag@example.test")).toBe(true)
        expect(isEmailAddress("person@example.x")).toBe(false)
        expect(isEmailAddress("person example@test.org")).toBe(false)
        expect(isEmailAddress("person@@example.test")).toBe(false)
        expect(isEmailAddress("<person@example.test>")).toBe(false)
        expect(isEmailAddress("person,tag@example.test")).toBe(false)
    })

    it("normalizes local and country-code phone numbers", () => {
        expect(normalizePhone("090 123 4567")).toBe("0901234567")
        expect(normalizePhone("+84 (90) 123-4567")).toBe("0901234567")
        expect(normalizePhone("84901234567")).toBe("0901234567")
        expect(normalizePhone("01234567890")).toBe("01234567890")
        expect(normalizePhone("84")).toBeNull()
        expect(normalizePhone("8490123456")).toBeNull()
        expect(normalizePhone("1234567890")).toBeNull()
        expect(normalizePhone("090123456789")).toBeNull()
        expect(normalizePhone("call me")).toBeNull()
    })

    it("reads the first whole or decimal number and accepts a decimal comma", () => {
        expect(firstNumber("worked 12 years and 3 months")).toBe(12)
        expect(firstNumber("1.5 years")).toBe(1.5)
        expect(firstNumber("1,5 years")).toBe(1.5)
        expect(firstNumber("no experience")).toBeNull()
    })

    it("cleans only text list entries before limiting their count", () => {
        expect(cleanTextList(["  one  ", 9, null, " ", "abcdef", "last"], 2, 3)).toEqual(["one", "abc"])
        expect(cleanTextList(undefined, 2, 3)).toEqual([])
        expect(cleanTextList("one", 2, 3)).toEqual([])
        expect(cleanTextList(["one"], 0, 3)).toEqual([])
    })
})
