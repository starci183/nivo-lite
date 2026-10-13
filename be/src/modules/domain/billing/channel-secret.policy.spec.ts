import { createCipheriv, randomBytes } from "node:crypto"
import { decryptSecret, sameText, sha256Hex } from "./channel-secret.policy"
import { BillingErrorCode } from "./errors/billing.error"

const KEY = randomBytes(32).toString("base64")

const encrypt = (plain: string, keyBase64: string): string => {
    const iv = randomBytes(12)
    const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyBase64, "base64"), iv)
    const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")
}

describe("channel secret policy", () => {
    describe("decryptSecret", () => {
        it("reads back what was stored under the key", () => {
            expect(decryptSecret(encrypt('{"secureKey":"k"}', KEY), KEY)).toBe('{"secureKey":"k"}')
        })

        it("fails without a key or with a key of the wrong size", () => {
            const stored = encrypt("x", KEY)
            const unreadable = expect.objectContaining({ code: BillingErrorCode.CredentialUnreadable })
            expect(() => decryptSecret(stored, undefined)).toThrow(unreadable)
            expect(() => decryptSecret(stored, Buffer.alloc(16).toString("base64"))).toThrow(unreadable)
        })

        it("fails for another key, a tampered value and a truncated one, keeping the cause", () => {
            const stored = encrypt("x", KEY)
            const tampered = Buffer.from(stored, "base64")
            tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 1
            const unreadable = expect.objectContaining({ code: BillingErrorCode.CredentialUnreadable })
            expect(() => decryptSecret(stored, randomBytes(32).toString("base64"))).toThrow(unreadable)
            expect(() => decryptSecret(tampered.toString("base64"), KEY)).toThrow(unreadable)
            const failure = (() => {
                try {
                    return decryptSecret("AAAA", KEY)
                } catch (error) {
                    return error
                }
            })()
            expect(failure).toHaveProperty("cause")
        })
    })

    describe("sameText", () => {
        it("compares texts of equal length in constant time and refuses any difference", () => {
            expect(sameText("abc", "abc")).toBe(true)
            expect(sameText("abc", "abd")).toBe(false)
            expect(sameText("abc", "abcd")).toBe(false)
        })
    })

    describe("sha256Hex", () => {
        it("is the SHA-256 hex digest", () => {
            expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        })
    })
})
