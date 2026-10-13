import { createHash } from "node:crypto"
import type { OptionalChannelKey } from "./connections.contracts"

const KEY_BYTES = 32

/** The AES key from its base64 form, or null when it is not exactly 32 bytes. */
export const decodeChannelKey = (base64: string): OptionalChannelKey => {
    const key = Buffer.from(base64, "base64")
    return key.length === KEY_BYTES ? key : null
}

/** The SHA-256 digest of a string, hex. */
export const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex")
