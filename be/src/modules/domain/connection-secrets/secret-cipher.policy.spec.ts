import { Test } from "@nestjs/testing"
import { createCipheriv, randomBytes } from "node:crypto"
import { ConnectionSecretsErrorCode } from "./errors/connection-secrets.error"
import {
    openSecret,
    openSecretWithBase64Key,
    parseTokenKey,
    randomSecret,
    safeEqual,
    sealSecret,
} from "./secret-cipher.policy"

const SUBJECT = Symbol("secret-cipher.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { parseTokenKey, sealSecret, openSecret, openSecretWithBase64Key, safeEqual, randomSecret },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./secret-cipher.policy")>(SUBJECT)
}

const KEY = randomBytes(32)
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)
const unreadable = objectLike({ code: ConnectionSecretsErrorCode.Unreadable })

/** What `run` throws, read as `unknown`. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

/** The legacy sealed form: base64(iv | tag | ciphertext), no version prefix. */
const sealLegacy = (key: Buffer, plain: string): string => {
    const iv = randomBytes(12)
    const cipher = createCipheriv("aes-256-gcm", key, iv)
    const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")
}

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

describe("secret-cipher key versions", () => {
    describe("key versions", () => {
        it("writes the v1 prefix and opens both the v1 and the legacy unprefixed form", async () => {
            const subject = await buildSubject()

            const sealed = subject.sealSecret(KEY, "fresh")

            expect(sealed.startsWith("v1:")).toBe(true)
            expect(subject.openSecret(KEY, sealed)).toBe("fresh")
            expect(subject.openSecret(KEY, sealLegacy(KEY, "old"))).toBe("old")
        })

        it("opens each version from a keyring and refuses a version the keyring lacks", async () => {
            const subject = await buildSubject()
            const second = randomBytes(32)
            const keyring = { v1: KEY, v2: second }
            const sealedV2 = `v2:${subject.sealSecret(second, "next").slice(3)}`

            expect(subject.openSecret(keyring, sealedV2)).toBe("next")
            expect(subject.openSecret(keyring, sealLegacy(KEY, "old"))).toBe("old")
            expect(thrownBy(() => subject.openSecret({ v1: KEY }, sealedV2))).toEqual(unreadable)
            expect(thrownBy(() => subject.openSecret(KEY, sealedV2))).toEqual(unreadable)
        })

        it("refuses a tampered ciphertext and the wrong key with the capability error, keeping the cause", async () => {
            const subject = await buildSubject()
            const sealed = subject.sealSecret(KEY, "secret")
            const bytes = Buffer.from(sealed.slice(3), "base64")
            bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1

            expect(thrownBy(() => subject.openSecret(KEY, `v1:${bytes.toString("base64")}`))).toEqual(unreadable)
            expect(thrownBy(() => subject.openSecret(randomBytes(32), sealed))).toEqual(unreadable)
            expect(thrownBy(() => subject.openSecret(KEY, "v1:AAAA"))).toHaveProperty("cause")
        })
    })

    describe("openSecretWithBase64Key", () => {
        it("opens with the raw key text and refuses a missing or wrongly sized key", async () => {
            const subject = await buildSubject()
            const sealed = subject.sealSecret(KEY, "x")

            expect(subject.openSecretWithBase64Key(sealed, KEY.toString("base64"))).toBe("x")
            expect(thrownBy(() => subject.openSecretWithBase64Key(sealed, ""))).toEqual(unreadable)
            expect(thrownBy(() => subject.openSecretWithBase64Key(sealed, randomBytes(16).toString("base64")))).toEqual(
                unreadable,
            )
        })
    })
})
