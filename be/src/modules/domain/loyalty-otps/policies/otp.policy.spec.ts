import type * as SubjectModule from "./otp.policy"
import { Test } from "@nestjs/testing"
import { OTP_MAX_ATTEMPTS, codeHash, codeText, sameHash } from "./otp.policy"

const SUBJECT = Symbol("otp.policy")
type Subject = Pick<typeof SubjectModule, "codeText" | "codeHash" | "sameHash">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { codeText, codeHash, sameHash } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("otp.policy", () => {
    it("allows five wrong tries", () => {
        expect(OTP_MAX_ATTEMPTS).toBe(5)
    })

    describe("codeText", () => {
        it("pads a drawn number to six digits", async () => {
            const subject = await buildSubject()

            expect(subject.codeText(42)).toBe("000042")
            expect(subject.codeText(123456)).toBe("123456")
        })
    })

    describe("codeHash", () => {
        it("depends on the pepper, the customer and the code", async () => {
            const subject = await buildSubject()

            const base = subject.codeHash("pepper", "c1", "123456")

            expect(base).toMatch(/^[0-9a-f]{64}$/u)
            expect(subject.codeHash("pepper", "c1", "123456")).toBe(base)
            expect(subject.codeHash("other", "c1", "123456")).not.toBe(base)
            expect(subject.codeHash("pepper", "c2", "123456")).not.toBe(base)
            expect(subject.codeHash("pepper", "c1", "654321")).not.toBe(base)
        })
    })

    describe("sameHash", () => {
        it("is true for equal hashes and false for different or malformed ones", async () => {
            const subject = await buildSubject()

            const hash = subject.codeHash("pepper", "c1", "123456")

            expect(subject.sameHash(hash, hash)).toBe(true)
            expect(subject.sameHash(hash, subject.codeHash("pepper", "c1", "000000"))).toBe(false)
            expect(subject.sameHash(hash, "abcd")).toBe(false)
        })
    })
})
