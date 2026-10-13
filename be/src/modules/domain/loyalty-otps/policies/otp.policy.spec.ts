import { OTP_MAX_ATTEMPTS, codeHash, codeText, sameHash } from "./otp.policy"

describe("otp.policy", () => {
    it("allows five wrong tries", () => {
        expect(OTP_MAX_ATTEMPTS).toBe(5)
    })

    describe("codeText", () => {
        it("pads a drawn number to six digits", () => {
            expect(codeText(42)).toBe("000042")
            expect(codeText(123456)).toBe("123456")
        })
    })

    describe("codeHash", () => {
        it("depends on the pepper, the customer and the code", () => {
            const base = codeHash("pepper", "c1", "123456")

            expect(base).toMatch(/^[0-9a-f]{64}$/u)
            expect(codeHash("pepper", "c1", "123456")).toBe(base)
            expect(codeHash("other", "c1", "123456")).not.toBe(base)
            expect(codeHash("pepper", "c2", "123456")).not.toBe(base)
            expect(codeHash("pepper", "c1", "654321")).not.toBe(base)
        })
    })

    describe("sameHash", () => {
        it("is true for equal hashes and false for different or malformed ones", () => {
            const hash = codeHash("pepper", "c1", "123456")

            expect(sameHash(hash, hash)).toBe(true)
            expect(sameHash(hash, codeHash("pepper", "c1", "000000"))).toBe(false)
            expect(sameHash(hash, "abcd")).toBe(false)
        })
    })
})
