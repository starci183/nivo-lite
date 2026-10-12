import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto"

const KEY_BYTES = 32
const IV_BYTES = 12
const TAG_BYTES = 16

/** The AES key from its base64 form, or null when it is not exactly 32 bytes. */
export const decodeChannelKey = (base64: string): Buffer | null => {
    const key = Buffer.from(base64, "base64")
    return key.length === KEY_BYTES ? key : null
}

/** Seals a credential as base64(iv(12) | tag(16) | ciphertext), the form stored since the first connection. */
export const encryptSecret = (key: Buffer, plain: string): string => {
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv("aes-256-gcm", key, iv)
    const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")
}

/** Opens a stored credential; throws when the key is wrong or the value was altered. */
export const decryptSecret = (key: Buffer, stored: string): string => {
    const buf = Buffer.from(stored, "base64")
    const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, IV_BYTES))
    decipher.setAuthTag(buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES))
    return Buffer.concat([decipher.update(buf.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8")
}

/** Constant-time string equality (different lengths are simply unequal). */
export const safeEqual = (a: string, b: string): boolean => {
    const x = Buffer.from(a)
    const y = Buffer.from(b)
    return x.length === y.length && timingSafeEqual(x, y)
}

/** A fresh random secret, 64 hex characters. */
export const randomSecret = (): string => randomBytes(32).toString("hex")

/** The SHA-256 digest of a string, hex. */
export const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex")
