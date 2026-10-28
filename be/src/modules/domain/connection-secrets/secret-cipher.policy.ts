import type { VersionedSeal } from "./connection-secrets.contracts"
import { ConnectionSecretsError, ConnectionSecretsErrorCode } from "./errors/connection-secrets.error"
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto"

const KEY_BYTES = 32
const IV_BYTES = 12
const TAG_BYTES = 16

/** The AES-256 key of a base64 text, or an empty buffer when it does not decode to exactly 32 bytes. */
export const parseTokenKey = (raw: string): Buffer => {
    const key = Buffer.from(raw, "base64")
    return key.length === KEY_BYTES ? key : Buffer.alloc(0)
}

/** The key version new seals are written under. */
export const CURRENT_KEY_VERSION = "v1"

/** Keys by version label (`v1`, `v2`, ...): a later key is added here and rows sealed under older versions still open. */
export type Keyring = Readonly<Record<string, Buffer>>

const VERSION_SEPARATOR = ":"
const LEGACY_VERSION = "v1"

/** Splits a stored text into its key version and the base64 body; the unprefixed legacy form (base64 has no ":") is v1. */
const splitVersion = (stored: string): VersionedSeal => {
    const at = stored.indexOf(VERSION_SEPARATOR)
    return at < 0
        ? { version: LEGACY_VERSION, body: stored }
        : { version: stored.slice(0, at), body: stored.slice(at + 1) }
}

/** Seals a text with AES-256-GCM. Stored form: `v1:` + base64(iv(12) | tag(16) | ciphertext). */
export const sealSecret = (key: Buffer, plain: string): string => {
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv("aes-256-gcm", key, iv)
    const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
    return `${CURRENT_KEY_VERSION}${VERSION_SEPARATOR}${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")}`
}

/** The key a version is opened with: a single key serves v1 only. */
const keyOfVersion = (keys: Buffer | Keyring, version: string): Buffer | undefined => {
    if (!Buffer.isBuffer(keys)) return keys[version]
    return version === LEGACY_VERSION ? keys : undefined
}

/**
 * Opens a sealed text, in the `v1:` form or the legacy unprefixed one (read as v1). A single key opens v1; a keyring opens the
 * version the text names. Anything unreadable (unknown version, wrong key, a changed value) is `CONNECTION_SECRETS_UNREADABLE`.
 */
export const openSecret = (keys: Buffer | Keyring, stored: string): string => {
    const { version, body } = splitVersion(stored)
    const key = keyOfVersion(keys, version)
    if (key === undefined) throw new ConnectionSecretsError({ code: ConnectionSecretsErrorCode.Unreadable })
    try {
        const bytes = Buffer.from(body, "base64")
        const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, IV_BYTES))
        decipher.setAuthTag(bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES))
        return Buffer.concat([decipher.update(bytes.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8")
    } catch (cause) {
        throw new ConnectionSecretsError({ code: ConnectionSecretsErrorCode.Unreadable, cause })
    }
}

/** Opens a sealed text with a key still in base64 (empty when missing), for readers that hold the raw CHANNEL_TOKEN_KEY text. */
export const openSecretWithBase64Key = (stored: string, keyBase64: string): string => {
    const key = parseTokenKey(keyBase64)
    if (key.length === 0) throw new ConnectionSecretsError({ code: ConnectionSecretsErrorCode.Unreadable })
    return openSecret(key, stored)
}

/** Constant-time string equality; strings of different lengths are simply unequal. */
export const safeEqual = (left: string, right: string): boolean => {
    const first = Buffer.from(left)
    const second = Buffer.from(right)
    return first.length === second.length && timingSafeEqual(first, second)
}

/** A fresh webhook secret: 32 random bytes, hex. */
export const randomSecret = (): string => randomBytes(32).toString("hex")
