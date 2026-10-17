import { Test } from "@nestjs/testing"
import { randomBytes } from "node:crypto"
import { openSecret, parseTokenKey, randomSecret, safeEqual, sealSecret } from "./secret-cipher.policy"

const SUBJECT = Symbol("secret-cipher.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { parseTokenKey, sealSecret, openSecret, safeEqual, randomSecret } }],
    }).compile()
    return moduleRef.get<typeof import("./secret-cipher.policy")>(SUBJECT)
}

const KEY = randomBytes(32)

describe("secret-cipher policy", () => {
    describe("parseTokenKey", () => {
        it("reads 32 bytes of base64 and answers an empty key for any other length", async () => {
            const subject = await buildSubject()

            expect(subject.parseTokenKey(KEY.toString("base64")).equals(KEY)).toBe(true)
            expect(subject.parseTokenKey(randomBytes(16).toString("base64"))).toHaveLength(0)
            expect(subject.parseTokenKey("")).toHaveLength(0)
        })
    })

    describe("sealSecret and openSecret", () => {
        it("round-trips a text and seals it differently every time", async () => {
            const subject = await buildSubject()

            const first = subject.sealSecret(KEY, '{"token":"a"}')

            expect(subject.openSecret(KEY, first)).toBe('{"token":"a"}')
            expect(subject.sealSecret(KEY, '{"token":"a"}')).not.toBe(first)
        })

        it("refuses a value sealed with another key or changed after sealing", async () => {
            const subject = await buildSubject()

            const sealed = subject.sealSecret(KEY, "secret")
            const changed = Buffer.from(sealed, "base64")
            changed[changed.length - 1] = (changed[changed.length - 1] ?? 0) ^ 1

            expect(() => subject.openSecret(randomBytes(32), sealed)).toThrow()
            expect(() => subject.openSecret(KEY, changed.toString("base64"))).toThrow()
        })
    })

    describe("safeEqual", () => {
        it("is true only for equal strings", async () => {
            const subject = await buildSubject()

            expect(subject.safeEqual("abc", "abc")).toBe(true)
            expect(subject.safeEqual("abc", "abd")).toBe(false)
            expect(subject.safeEqual("abc", "abcd")).toBe(false)
        })
    })

    describe("randomSecret", () => {
        it("makes 64 hex characters that differ per call", async () => {
            const subject = await buildSubject()

            expect(subject.randomSecret()).toMatch(/^[0-9a-f]{64}$/u)
            expect(subject.randomSecret()).not.toBe(subject.randomSecret())
        })
    })
})
