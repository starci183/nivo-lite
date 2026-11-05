import { createHmac, timingSafeEqual } from "node:crypto"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import type { KeysetPosition } from "./policies/compiler.contracts"

/** The longest cursor text the engine reads (the query bound is 2000). */
export const CURSOR_TEXT_MAX = 2000

/** The most ordered expressions a cursor position holds (the order of a query holds at most 8 keys). */
const POSITION_MAX = 8

const VERSION = 1

const encode = (buffer: Buffer): string => buffer.toString("base64url")

const isPosition = (value: unknown): value is KeysetPosition =>
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= POSITION_MAX &&
    value.every((part) => part === null || typeof part === "string")

/**
 * The opaque cursor of the page after a row: the version, the scope of the list (a hash of its read, filters and sort) and the position
 * (the text of each ordered expression of the row), signed with HMAC-SHA256. It carries no workspace: the scope of the transaction
 * decides which rows exist, so a cursor can only move within what the caller may read.
 */
export const signCursor = (key: Buffer, scope: string, position: KeysetPosition): string => {
    const body = encode(Buffer.from(JSON.stringify({ v: VERSION, s: scope, p: position })))
    return `${body}.${encode(createHmac("sha256", key).update(body).digest())}`
}

/** The position a cursor holds when its signature is valid and it was minted for `scope`; otherwise null (forged, truncated or for another list). */
export const readCursor = (key: Buffer, scope: string, text: string): KeysetPosition | null => {
    if (text.length > CURSOR_TEXT_MAX) return null
    const [body, signature, extra] = text.split(".")
    if (!body || !signature || extra !== undefined) return null
    const expected = createHmac("sha256", key).update(body).digest()
    const given = Buffer.from(signature, "base64url")
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
    const read = parseJsonText(Buffer.from(body, "base64url").toString("utf8"))
    if (!read.ok || !isRecord(read.value)) return null
    const { v, s, p } = read.value
    return v === VERSION && s === scope && isPosition(p) ? p : null
}
