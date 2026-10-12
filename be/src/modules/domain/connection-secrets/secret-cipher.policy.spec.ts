import { randomBytes } from "node:crypto"
import { openSecret, parseTokenKey, randomSecret, safeEqual, sealSecret } from "./secret-cipher.policy"

const KEY = randomBytes(32)

describe("secret-cipher policy", () => {
    describe("parseTokenKey", () => {
        it("reads 32 bytes of base64 and answers an empty key for any other length", () => {
            expect(parseTokenKey(KEY.toString("base64")).equals(KEY)).toBe(true)
            expect(parseTokenKey(randomBytes(16).toString("base64"))).toHaveLength(0)
            expect(parseTokenKey("")).toHaveLength(0)
        })
    })

    describe("sealSecret and openSecret", () => {
        it("round-trips a text and seals it differently every time", () => {
            const first = sealSecret(KEY, '{"token":"a"}')

            expect(openSecret(KEY, first)).toBe('{"token":"a"}')
            expect(sealSecret(KEY, '{"token":"a"}')).not.toBe(first)
        })

        it("refuses a value sealed with another key or changed after sealing", () => {
            const sealed = sealSecret(KEY, "secret")
            const changed = Buffer.from(sealed, "base64")
            changed[changed.length - 1] = (changed[changed.length - 1] ?? 0) ^ 1

            expect(() => openSecret(randomBytes(32), sealed)).toThrow()
            expect(() => openSecret(KEY, changed.toString("base64"))).toThrow()
        })
    })

    describe("safeEqual", () => {
        it("is true only for equal strings", () => {
            expect(safeEqual("abc", "abc")).toBe(true)
            expect(safeEqual("abc", "abd")).toBe(false)
            expect(safeEqual("abc", "abcd")).toBe(false)
        })
    })

    describe("randomSecret", () => {
        it("makes 64 hex characters that differ per call", () => {
            expect(randomSecret()).toMatch(/^[0-9a-f]{64}$/u)
            expect(randomSecret()).not.toBe(randomSecret())
        })
    })
})
