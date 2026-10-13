import { createHash, timingSafeEqual } from "node:crypto"

/** The most wrong tries a code allows. */
export const OTP_MAX_ATTEMPTS = 5

/** The digits of a drawn number as a six-digit code. */
export const codeText = (drawn: number): string => String(drawn).padStart(6, "0")

/** The hash stored for a code: the code, the customer and the secret pepper together. */
export const codeHash = (pepper: string, customerId: string, code: string): string =>
    createHash("sha256").update(`${pepper}:${customerId}:${code}`).digest("hex")

/** Whether two hex hashes are the same, compared in constant time. */
export const sameHash = (stored: string, given: string): boolean => {
    const a = Buffer.from(stored, "hex")
    const b = Buffer.from(given, "hex")
    return a.length === b.length && timingSafeEqual(a, b)
}
