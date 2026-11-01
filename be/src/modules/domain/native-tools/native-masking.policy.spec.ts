import { Test } from "@nestjs/testing"
import { clipped, customerMasked, emailMasked, isoTextOf, needsAttention } from "./native-masking.policy"

/** The members of the subject under test. */
interface Subject {
    readonly clipped: typeof clipped
    readonly customerMasked: typeof customerMasked
    readonly emailMasked: typeof emailMasked
    readonly isoTextOf: typeof isoTextOf
    readonly needsAttention: typeof needsAttention
}

const SUBJECT = Symbol("native-masking.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { clipped, customerMasked, emailMasked, isoTextOf, needsAttention } },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("clipped", () => {
    it("keeps a short text and cuts a long one with an ellipsis", async () => {
        const subject = await build()
        expect(subject.clipped("short", 10)).toBe("short")
        expect(subject.clipped("a long sentence", 8)).toBe("a long…")
    })
})

describe("customerMasked", () => {
    it("shows the first and the last characters of the id, a third of it at most", async () => {
        const subject = await build()
        expect(subject.customerMasked("5540123456302")).toBe("55…2")
        expect(subject.customerMasked("1234567890")).toBe("12…0")
        expect(subject.customerMasked("1234567890123456789")).toBe("123…89")
    })

    it("never shows more than seven characters, whatever the id's length", async () => {
        const subject = await build()
        expect(subject.customerMasked("1".repeat(60))).toBe("11111…11")
    })

    it("hides at least seven tenths of every id it shows anything of", async () => {
        const subject = await build()
        for (const length of [6, 7, 9, 10, 13, 19, 40]) {
            const shown = subject.customerMasked("7".repeat(length)).replace("…", "").length
            expect(shown / length).toBeLessThanOrEqual(0.3)
        }
    })

    it("shows nothing for an id too short to hide anything, or for no id", async () => {
        const subject = await build()
        expect(subject.customerMasked("12345")).toBe("")
        expect(subject.customerMasked("  12  ")).toBe("")
        expect(subject.customerMasked(null)).toBe("")
    })
})

describe("emailMasked", () => {
    it("masks the local part down to its first character", async () => {
        const subject = await build()
        expect(subject.emailMasked("lan.nguyen@shop.vn")).toBe("l***@shop.vn")
    })

    it("shows nothing for a text with no local part or no domain, or for none", async () => {
        const subject = await build()
        expect(subject.emailMasked("@shop.vn")).toBe("")
        expect(subject.emailMasked("no-domain")).toBe("")
        expect(subject.emailMasked(null)).toBe("")
    })
})

describe("needsAttention", () => {
    it("is false for a connected connection with no recorded failure", async () => {
        const subject = await build()
        expect(subject.needsAttention("connected", null)).toBe(false)
        expect(subject.needsAttention("connected", "  ")).toBe(false)
    })

    it("is true when it is not connected or a failure is recorded", async () => {
        const subject = await build()
        expect(subject.needsAttention("error", null)).toBe(true)
        expect(subject.needsAttention("pending", null)).toBe(true)
        expect(subject.needsAttention("connected", "invalid_grant")).toBe(true)
    })
})

describe("isoTextOf", () => {
    it("words a database instant as ISO 8601", async () => {
        const subject = await build()
        expect(subject.isoTextOf("2026-10-30 10:12:00.123+00")).toBe("2026-10-30T10:12:00.123Z")
    })

    it("answers nothing for a text that is no instant", async () => {
        const subject = await build()
        expect(subject.isoTextOf("soon")).toBe("")
    })
})
