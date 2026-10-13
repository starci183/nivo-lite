import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto"

const KEY_BYTES = 32
const IV_BYTES = 12
const TAG_BYTES = 16

/** The AES-256 key of a base64 text, or an empty buffer when it does not decode to exactly 32 bytes. */
export const parseTokenKey = (raw: string): Buffer => {
    const key = Buffer.from(raw, "base64")
    return key.length === KEY_BYTES ? key : Buffer.alloc(0)
}

/** Seals a text with AES-256-GCM. Stored form: base64(iv(12) | tag(16) | ciphertext). */
export const sealSecret = (key: Buffer, plain: string): string => {
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv("aes-256-gcm", key, iv)
    const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")
}

/** Opens a sealed text; throws when the tag does not match (a wrong key or a changed value). */
export const openSecret = (key: Buffer, stored: string): string => {
    const bytes = Buffer.from(stored, "base64")
    const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, IV_BYTES))
    decipher.setAuthTag(bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES))
    return Buffer.concat([decipher.update(bytes.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8")
}

/** Constant-time string equality; strings of different lengths are simply unequal. */
export const safeEqual = (left: string, right: string): boolean => {
    const first = Buffer.from(left)
    const second = Buffer.from(right)
    return first.length === second.length && timingSafeEqual(first, second)
}

/** A fresh webhook secret: 32 random bytes, hex. */
export const randomSecret = (): string => randomBytes(32).toString("hex")
