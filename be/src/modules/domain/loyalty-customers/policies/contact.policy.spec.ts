import { Test } from "@nestjs/testing"
import { toLoyaltyEmail, toLoyaltyPhone } from "./contact.policy"

const SUBJECT = Symbol("contact.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toLoyaltyPhone, toLoyaltyEmail } }],
    }).compile()
    return moduleRef.get<typeof import("./contact.policy")>(SUBJECT)
}

describe("contact.policy", () => {
    describe("toLoyaltyPhone", () => {
        it("turns the usual ways of writing one number into the 84 form", async () => {
            const subject = await buildSubject()

            expect(subject.toLoyaltyPhone("0912 345 678")).toBe("84912345678")
            expect(subject.toLoyaltyPhone("+84 912 345 678")).toBe("84912345678")
            expect(subject.toLoyaltyPhone("0084912345678")).toBe("84912345678")
            expect(subject.toLoyaltyPhone("912345678")).toBe("84912345678")
            expect(subject.toLoyaltyPhone("84912345678")).toBe("84912345678")
        })

        it("accepts a landline of ten digits after the country code", async () => {
            const subject = await buildSubject()

            expect(subject.toLoyaltyPhone("02838123456")).toBe("842838123456")
        })

        it("answers null for anything that is not a plausible number", async () => {
            const subject = await buildSubject()

            expect(subject.toLoyaltyPhone(null)).toBeNull()
            expect(subject.toLoyaltyPhone("")).toBeNull()
            expect(subject.toLoyaltyPhone("abc")).toBeNull()
            expect(subject.toLoyaltyPhone("12345")).toBeNull()
            expect(subject.toLoyaltyPhone("1234567890123")).toBeNull()
        })
    })

    describe("toLoyaltyEmail", () => {
        it("lower-cases and trims an address", async () => {
            const subject = await buildSubject()

            expect(subject.toLoyaltyEmail("  Anna@Example.COM ")).toBe("anna@example.com")
        })

        it("answers null for text that is not an address", async () => {
            const subject = await buildSubject()

            expect(subject.toLoyaltyEmail("anna")).toBeNull()
            expect(subject.toLoyaltyEmail("")).toBeNull()
            expect(subject.toLoyaltyEmail(null)).toBeNull()
        })
    })
})

describe("loyalty email shape boundaries", () => {
    it.each<[string, string | null]>([
        [" A@B.C. ", "a@b.c."],
        ["a@.b.c", "a@.b.c"],
        ["a@.b", null],
        ["a@@b.c", null],
        ["a@" + "b".repeat(20000), null],
    ])("normalizes %s while retaining the address shape", async (value, expected) => {
        const subject = await buildSubject()
        expect(subject.toLoyaltyEmail(value)).toBe(expected)
    })
})
