import { randomBytes } from "node:crypto"
import {
    decodeChannelKey,
    decryptSecret,
    encryptSecret,
    randomSecret,
    safeEqual,
    sha256,
} from "./connection-cipher.policy"

const key = randomBytes(32)

describe("connection cipher policy", () => {
    describe("decodeChannelKey", () => {
        it("accepts 32 bytes in base64", () => {
            expect(decodeChannelKey(key.toString("base64"))).toEqual(key)
        })

        it("refuses any other length", () => {
            expect(decodeChannelKey(randomBytes(16).toString("base64"))).toBeNull()
            expect(decodeChannelKey("")).toBeNull()
        })
    })

    describe("encryptSecret and decryptSecret", () => {
        it("round-trips and lays the stored form out as iv, tag, ciphertext", () => {
            const stored = encryptSecret(key, "token-1")

            expect(Buffer.from(stored, "base64")).toHaveLength(12 + 16 + "token-1".length)
            expect(decryptSecret(key, stored)).toBe("token-1")
        })

        it("seals the same text differently each time", () => {
            expect(encryptSecret(key, "a")).not.toBe(encryptSecret(key, "a"))
        })

        it("refuses a value opened with another key or altered", () => {
            const stored = encryptSecret(key, "token-1")
            const altered = Buffer.from(stored, "base64")
            altered.writeUInt8(altered.readUInt8(altered.length - 1) ^ 1, altered.length - 1)

            expect(() => decryptSecret(randomBytes(32), stored)).toThrow()
            expect(() => decryptSecret(key, altered.toString("base64"))).toThrow()
        })
    })

    describe("safeEqual", () => {
        it("compares equal and different strings", () => {
            expect(safeEqual("abc", "abc")).toBe(true)
            expect(safeEqual("abc", "abd")).toBe(false)
            expect(safeEqual("abc", "abcd")).toBe(false)
        })
    })

    describe("randomSecret and sha256", () => {
        it("makes 64 hex characters, never the same twice", () => {
            expect(randomSecret()).toMatch(/^[0-9a-f]{64}$/)
            expect(randomSecret()).not.toBe(randomSecret())
        })

        it("hashes to the known digest", () => {
            expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        })
    })
})
