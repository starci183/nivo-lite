import { createHash, timingSafeEqual } from "node:crypto"
import { ZaloError, ZaloErrorCode } from "./errors/zalo.error"

const sameDigest = (given: string, expected: string): boolean => {
    const actual = Buffer.from(given)
    const wanted = Buffer.from(expected)
    return actual.length === wanted.length && timingSafeEqual(actual, wanted)
}

/** The event time the signature covers, read from the body; undefined when it carries none. A body that is not JSON is a ZaloError. */
const timestampOf = (rawBody: string): string | undefined => {
    try {
        const parsed: unknown = JSON.parse(rawBody)
        const timestamp: unknown =
            typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "timestamp") : undefined
        return typeof timestamp === "string" || typeof timestamp === "number" ? String(timestamp) : undefined
    } catch (cause) {
        throw new ZaloError({ code: ZaloErrorCode.BodyUnreadable, cause })
    }
}

/**
 * Zalo signs every webhook with a `mac=<hex>` header: the sha256 of app id, raw body, event time and the OA secret key, joined with no separator. The
 * compare is constant-time and fails closed on any missing piece.
 */
export const isValidZaloMac = (appId: string, rawBody: string, oaSecret: string, header?: string): boolean => {
    if (!header || !appId || !oaSecret) return false
    const timestamp = timestampOf(rawBody)
    if (timestamp === undefined) return false
    const given = header.trim().replace(/^mac=/iu, "").toLowerCase()
    const expected = createHash("sha256").update(`${appId}${rawBody}${timestamp}${oaSecret}`).digest("hex")
    return sameDigest(given, expected)
}
