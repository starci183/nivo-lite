import { Test } from "@nestjs/testing"
import { digestOf, isAcceptablePassword, isPresentablePassword, normalizeEmail } from "./password.policy"

const SUBJECT = Symbol("password.policy")
type Subject = {
    digestOf: typeof digestOf
    isAcceptablePassword: typeof isAcceptablePassword
    isPresentablePassword: typeof isPresentablePassword
    normalizeEmail: typeof normalizeEmail
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { digestOf, isAcceptablePassword, isPresentablePassword, normalizeEmail } },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("normalizeEmail", () => {
    it("trims and lower-cases the sign-in address", async () => {
        const subject = await build()

        expect(subject.normalizeEmail("  An@Example.TEST ")).toBe("an@example.test")
    })
})

describe("isAcceptablePassword", () => {
    it("accepts 8 characters up to the 72 bytes bcrypt reads", async () => {
        const subject = await build()

        expect(subject.isAcceptablePassword("12345678")).toBe(true)
        expect(subject.isAcceptablePassword("x".repeat(72))).toBe(true)
    })

    it("refuses a short password and one longer than 72 bytes, counting bytes not characters", async () => {
        const subject = await build()

        expect(subject.isAcceptablePassword("1234567")).toBe(false)
        expect(subject.isAcceptablePassword("x".repeat(73))).toBe(false)
        expect(subject.isAcceptablePassword(String.fromCodePoint(233).repeat(40))).toBe(false)
    })
})

describe("isPresentablePassword", () => {
    it("admits any non-empty password up to 72 bytes", async () => {
        const subject = await build()

        expect(subject.isPresentablePassword("a")).toBe(true)
        expect(subject.isPresentablePassword("")).toBe(false)
        expect(subject.isPresentablePassword("x".repeat(73))).toBe(false)
    })
})

describe("digestOf", () => {
    it("is the SHA-256 hex of the text", async () => {
        const subject = await build()

        expect(subject.digestOf("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    })
})
