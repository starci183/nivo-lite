import { createHash, timingSafeEqual } from "node:crypto"

/** Constant-time text equality; texts of different lengths are simply unequal. */
export const sameText = (given: string, wanted: string): boolean => {
    const left = Buffer.from(given)
    const right = Buffer.from(wanted)
    return left.length === right.length && timingSafeEqual(left, right)
}

/** The SHA-256 hex digest of a text: how the webhook secret of a SePay feed is stored. */
export const sha256Hex = (text: string): string => createHash("sha256").update(text).digest("hex")
