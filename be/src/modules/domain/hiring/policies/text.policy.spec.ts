import { Test } from "@nestjs/testing"
import {
    EMAIL_MAX,
    RESERVED_SLUGS,
    cleanTextList as cleanTextListImplementation,
    clip as clipImplementation,
    firstNumber as firstNumberImplementation,
    fold as foldImplementation,
    isEmailAddress as isEmailAddressImplementation,
    isToken as isTokenImplementation,
    normalizePhone as normalizePhoneImplementation,
    slugify as slugifyImplementation,
} from "./text.policy"

const SUBJECT = Symbol("subject")
type Subject = {
    cleanTextList: typeof cleanTextListImplementation
    clip: typeof clipImplementation
    firstNumber: typeof firstNumberImplementation
    fold: typeof foldImplementation
    isEmailAddress: typeof isEmailAddressImplementation
    isToken: typeof isTokenImplementation
    normalizePhone: typeof normalizePhoneImplementation
    slugify: typeof slugifyImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    cleanTextList: cleanTextListImplementation,
                    clip: clipImplementation,
                    firstNumber: firstNumberImplementation,
                    fold: foldImplementation,
                    isEmailAddress: isEmailAddressImplementation,
                    isToken: isTokenImplementation,
                    normalizePhone: normalizePhoneImplementation,
                    slugify: slugifyImplementation,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("hiring text policy", () => {
    it("exposes the email limit and reserved public slugs", () => {
        expect(EMAIL_MAX).toBe(254)
        expect(RESERVED_SLUGS).toEqual(["lich", "thu", "api", "admin"])
    })

    it("trims and clips text at the requested length", async () => {
        const subject = await buildSubject()
        expect(subject.clip("  abcdef  ", 3)).toBe("abc")
        expect(subject.clip("  abc  ", 10)).toBe("abc")
        expect(subject.clip("  abc  ", 0)).toBe("")
    })

    it("folds case, combining accents and the letter d with a stroke", async () => {
        const subject = await buildSubject()
        const accented = String.fromCodePoint(0x110, 0x1eb7, 0x6e, 0x67, 0x20, 0xc9)

        expect(subject.fold(accented)).toBe("dang e")
        expect(subject.fold(`A${String.fromCodePoint(0x301)}`)).toBe("a")
        expect(subject.fold("CASHIER 123")).toBe("cashier 123")
    })

    it("derives bounded slugs and removes boundary dashes after clipping", async () => {
        const subject = await buildSubject()
        expect(subject.slugify("  CASHIER / Floor 2026!  ")).toBe("cashier-floor-2026")
        expect(subject.slugify("aa bb cc", 3)).toBe("aa")
        expect(subject.slugify("x".repeat(61))).toBe("x".repeat(60))
        expect(subject.slugify("! @ #")).toBe("")
        expect(subject.slugify(String.fromCodePoint(0x110, 0x1eb7, 0x6e, 0x67))).toBe("dang")
    })

    it("accepts only thirty-two lower-case hexadecimal token characters", async () => {
        const subject = await buildSubject()
        expect(subject.isToken("0123456789abcdef0123456789abcdef")).toBe(true)
        expect(subject.isToken("a".repeat(31))).toBe(false)
        expect(subject.isToken("a".repeat(33))).toBe(false)
        expect(subject.isToken("A".repeat(32))).toBe(false)
        expect(subject.isToken("g".repeat(32))).toBe(false)
    })

    it("accepts email shapes and rejects whitespace and excluded punctuation", async () => {
        const subject = await buildSubject()
        expect(subject.isEmailAddress("person+tag@example.test")).toBe(true)
        expect(subject.isEmailAddress("person@example.x")).toBe(false)
        expect(subject.isEmailAddress("person example@test.org")).toBe(false)
        expect(subject.isEmailAddress("person@@example.test")).toBe(false)
        expect(subject.isEmailAddress("<person@example.test>")).toBe(false)
        expect(subject.isEmailAddress("person,tag@example.test")).toBe(false)
    })

    it("normalizes local and country-code phone numbers", async () => {
        const subject = await buildSubject()
        expect(subject.normalizePhone("090 123 4567")).toBe("0901234567")
        expect(subject.normalizePhone("+84 (90) 123-4567")).toBe("0901234567")
        expect(subject.normalizePhone("84901234567")).toBe("0901234567")
        expect(subject.normalizePhone("01234567890")).toBe("01234567890")
        expect(subject.normalizePhone("84")).toBeNull()
        expect(subject.normalizePhone("8490123456")).toBeNull()
        expect(subject.normalizePhone("1234567890")).toBeNull()
        expect(subject.normalizePhone("090123456789")).toBeNull()
        expect(subject.normalizePhone("call me")).toBeNull()
    })

    it("reads the first whole or decimal number and accepts a decimal comma", async () => {
        const subject = await buildSubject()
        expect(subject.firstNumber("worked 12 years and 3 months")).toBe(12)
        expect(subject.firstNumber("1.5 years")).toBe(1.5)
        expect(subject.firstNumber("1,5 years")).toBe(1.5)
        expect(subject.firstNumber("no experience")).toBeNull()
    })

    it("cleans only text list entries before limiting their count", async () => {
        const subject = await buildSubject()
        expect(subject.cleanTextList(["  one  ", 9, null, " ", "abcdef", "last"], 2, 3)).toEqual(["one", "abc"])
        expect(subject.cleanTextList(undefined, 2, 3)).toEqual([])
        expect(subject.cleanTextList("one", 2, 3)).toEqual([])
        expect(subject.cleanTextList(["one"], 0, 3)).toEqual([])
    })
})

describe("linear text boundaries", () => {
    it("retains permissive email suffixes and handles long near misses", async () => {
        const subject = await buildSubject()
        expect(subject.isEmailAddress("a@b.co.")).toBe(true)
        expect(subject.isEmailAddress("a@.abc")).toBe(false)
        expect(subject.isEmailAddress("a@b..ab")).toBe(true)
        expect(subject.isEmailAddress(`a@${"a".repeat(20000)}`)).toBe(false)
        expect(subject.slugify("-".repeat(20000))).toBe("")
        expect(subject.slugify("--abc def--", 4)).toBe("abc")
    })
})
