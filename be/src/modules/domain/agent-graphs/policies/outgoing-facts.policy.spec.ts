import { Test } from "@nestjs/testing"
import {
    OUTGOING_AMOUNT,
    OUTGOING_HAS_AMOUNT,
    OUTGOING_HAS_LINK,
    OUTGOING_HAS_PHONE,
    OUTGOING_LENGTH,
    OUTGOING_SAYS_RECEIVED,
    amountsOf,
    outgoingFactsOf,
    plainOf,
} from "./outgoing-facts.policy"

/** The members of the subject under test. */
interface Subject {
    readonly amountsOf: typeof amountsOf
    readonly outgoingFactsOf: typeof outgoingFactsOf
    readonly plainOf: typeof plainOf
}

const SUBJECT = Symbol("outgoing-facts.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { amountsOf, outgoingFactsOf, plainOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("outgoing-facts.policy plainOf", () => {
    it("lower-cases a text and takes its accents away, the barred d of either case included", async () => {
        const subject = await build()

        expect(subject.plainOf("\u0110\u00E3 nh\u1EADn \u0110\u1ED2NG, t\u1EF7")).toBe("da nhan dong, ty")
        expect(subject.plainOf("\u0111")).toBe("d")
    })
})

describe("outgoing-facts.policy amountsOf", () => {
    it.each([
        ["5tr", [5_000_000]],
        ["5 tr", [5_000_000]],
        ["5tr5", [5_500_000]],
        ["1,5 trieu", [1_500_000]],
        ["1,5 tri\u1EC7u", [1_500_000]],
        ["1.5 Tri\u1EC7u", [1_500_000]],
        ["500k", [500_000]],
        ["12.5k", [12_500]],
        ["5k5", [5_500]],
        ["2 ty", [2_000_000_000]],
        ["2 t\u1EF7", [2_000_000_000]],
        ["3 nghin", [3000]],
        ["3 ng\u00E0n", [3000]],
        ["5.000.000d", [5_000_000]],
        ["5.000.000\u0111", [5_000_000]],
        ["5.000.000 VND", [5_000_000]],
        ["5,000,000 dong", [5_000_000]],
        ["100\u20AB", [100]],
        ["5.000.000", [5_000_000]],
        ["Tong 5.000.000.", [5_000_000]],
        ["gia 200k, coc 1tr", [200_000, 1_000_000]],
    ])("reads %p as %p", async (text, expected) => {
        const subject = await build()

        expect(subject.amountsOf(text)).toEqual(expected)
    })

    it.each([
        ["a phone number", "Goi 0901234567 nhe"],
        ["a phone number written in groups", "Goi 0901.234.567 nhe"],
        ["a phone number with spaces", "Goi 090 123 4567 nhe"],
        ["a distance", "Cach day 3 km"],
        ["a weight", "Nang 5kg"],
        ["a quantity", "Lay 2 cai"],
        ["a figure that is no number at all", "Gia la 5 trieuabc"],
        ["a sum too large to be a number", `${"9".repeat(400)}tr`],
        ["a text with no figure", "Xin chao"],
    ])("reads no sum in %s", async (_label, text) => {
        const subject = await build()

        expect(subject.amountsOf(text)).toEqual([])
    })
})

describe("outgoing-facts.policy outgoingFactsOf", () => {
    it("reads the largest sum, the phone, the length and the money words of a text", async () => {
        const subject = await build()
        const text = "Tong 5tr5, coc 500k. Goi 0901234567."

        expect(subject.outgoingFactsOf(text)).toEqual({
            [OUTGOING_AMOUNT]: 5_500_000,
            [OUTGOING_HAS_AMOUNT]: true,
            [OUTGOING_HAS_LINK]: false,
            [OUTGOING_HAS_PHONE]: true,
            [OUTGOING_LENGTH]: 36,
            [OUTGOING_SAYS_RECEIVED]: false,
        })
    })

    it("reads 0 and no amount for a text that states no sum, which is a reading and not a gap", async () => {
        const subject = await build()

        expect(subject.outgoingFactsOf("Cach day 3 km")).toEqual({
            [OUTGOING_AMOUNT]: 0,
            [OUTGOING_HAS_AMOUNT]: false,
            [OUTGOING_HAS_LINK]: false,
            [OUTGOING_HAS_PHONE]: false,
            [OUTGOING_LENGTH]: 13,
            [OUTGOING_SAYS_RECEIVED]: false,
        })
    })

    it.each([
        ["a web address", "Xem tai https://shop.example/menu", true],
        ["a www address", "Xem www.shop.example", true],
        ["a bare domain", "Xem shop.vn nhe", true],
        ["words only", "Xem menu nhe", false],
    ])("tells whether a text holds a link: %s", async (_label, text, expected) => {
        const subject = await build()

        expect(subject.outgoingFactsOf(text)[OUTGOING_HAS_LINK]).toBe(expected)
    })

    it.each([
        ["a local number", "Goi 0901234567", true],
        ["a number with the country code", "Goi +84901234567", true],
        ["a number with dashes", "Goi 090-123-4567", true],
        ["a sum", "Gia 5.000.000", false],
        ["words only", "Goi lai sau", false],
    ])("tells whether a text holds a phone number: %s", async (_label, text, expected) => {
        const subject = await build()

        expect(subject.outgoingFactsOf(text)[OUTGOING_HAS_PHONE]).toBe(expected)
    })

    it.each([
        ["D\u1EA1 shop \u0111\u00E3 nh\u1EADn ti\u1EC1n c\u1EE7a b\u1EA1n r\u1ED3i \u1EA1", true],
        ["Shop da nhan duoc chuyen khoan", true],
        ["Thanh to\u00E1n th\u00E0nh c\u00F4ng", true],
        ["Your payment received, thanks", true],
        ["We received your payment", true],
        ["Shop se kiem tra khoan chuyen", false],
    ])("tells whether the text says money arrived: %s", async (text, expected) => {
        const subject = await build()

        expect(subject.outgoingFactsOf(text)[OUTGOING_SAYS_RECEIVED]).toBe(expected)
    })

    it.each([[null], [undefined], [""], ["   \n"]])("answers nothing for a blank text %p", async (text) => {
        const subject = await build()

        expect(subject.outgoingFactsOf(text)).toEqual({})
    })
})
