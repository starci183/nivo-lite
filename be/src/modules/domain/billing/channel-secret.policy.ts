import { createDecipheriv, createHash, timingSafeEqual } from "node:crypto"
import { BillingError, BillingErrorCode } from "./errors/billing.error"

const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_BYTES = 32

/** Constant-time text equality; texts of different lengths are simply unequal. */
export const sameText = (given: string, wanted: string): boolean => {
    const left = Buffer.from(given)
    const right = Buffer.from(wanted)
    return left.length === right.length && timingSafeEqual(left, right)
}

/** The SHA-256 hex digest of a text: how the webhook secret of a SePay feed is stored. */
export const sha256Hex = (text: string): string => createHash("sha256").update(text).digest("hex")

/**
 * Decrypts a stored connection credential: base64(iv(12) | tag(16) | ciphertext) under AES-256-GCM with the 32-byte base64 key.
 * Anything that cannot be read (no key, a key of the wrong size, a tampered or truncated value) is a credential-unreadable error.
 */
export const decryptSecret = (stored: string, keyBase64: string | undefined): string => {
    const key = keyBase64 === undefined ? Buffer.alloc(0) : Buffer.from(keyBase64, "base64")
    if (key.length !== KEY_BYTES) throw new BillingError({ code: BillingErrorCode.CredentialUnreadable })
    const bytes = Buffer.from(stored, "base64")
    try {
        const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, IV_BYTES))
        decipher.setAuthTag(bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES))
        return Buffer.concat([decipher.update(bytes.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8")
    } catch (cause) {
        throw new BillingError({ code: BillingErrorCode.CredentialUnreadable, cause })
    }
}
