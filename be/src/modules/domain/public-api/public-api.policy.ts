import { createHash } from "node:crypto"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { PublicApiErrorCode } from "./errors/public-api.error"

/** Characters of the text of one knowledge source. */
export const SOURCE_CHARS_MAX = 120_000

/** Tags kept on one knowledge source. */
export const TAGS_MAX = 12

/** The window of events read when the caller names none: one day. */
const EVENTS_DEFAULT_WINDOW_MS = 86_400_000

/** Normalises a contact: a Vietnamese phone becomes `84` digits, an email is lowercased; null when empty. */
export const normaliseContact = (raw: string | null | undefined): string | null => {
    const value = (raw ?? "").trim()
    if (value === "") return null
    if (value.includes("@")) return value.toLowerCase()
    let digits = value.replace(/\D/g, "")
    if (digits === "") return null
    if (digits.startsWith("0")) digits = `84${digits.slice(1)}`
    else if (!digits.startsWith("84") && digits.length === 9) digits = `84${digits}`
    return digits
}

/** Splits a contact into the phone and the email it holds, both normalised. */
export const contactParts = (raw: string | null): { phone: string | null; email: string | null } => {
    const contact = normaliseContact(raw)
    return {
        phone: contact !== null && !contact.includes("@") ? contact : null,
        email: contact !== null && contact.includes("@") ? contact : null,
    }
}

/** The channel event id of a customer handed over by a key: the caller's external id makes a repeat the same customer. */
export const leadEventId = (keyId: string, externalId: string, fresh: string): string =>
    `api:${keyId}:${externalId === "" ? fresh : externalId}`

/** The inbound idempotency key of a customer handed over by the API. */
export const leadDedupeKey = (eventId: string): string => `manual:lead:${eventId}`

/** The work item dedupe key of a message: the same key and conversation is one message, whatever the retries. */
export const messageDedupeKey = (keyId: string, idempotencyKey: string, conversationId: string): string =>
    `api:message:${keyId}:${createHash("sha256").update(`${idempotencyKey}:${conversationId}`).digest("hex").slice(0, 24)}`

/** The start of an events window: the caller's `since`, or one day before `now`; refused when `since` is not a time. */
export const eventsSince = (since: string | undefined, now: Date): Outcome<string, PublicApiErrorCode> => {
    const from = since === undefined ? now.getTime() - EVENTS_DEFAULT_WINDOW_MS : Date.parse(since)
    return Number.isFinite(from) ? ok(new Date(from).toISOString()) : refused(PublicApiErrorCode.SinceInvalid)
}

/** Keeps at most twelve tags, each at most forty characters, with no blanks. */
export const cleanTags = (tags: ReadonlyArray<string>): Array<string> =>
    tags
        .map((tag) => tag.trim().slice(0, 40))
        .filter((tag) => tag !== "")
        .slice(0, TAGS_MAX)

/** Refuses a source text longer than one source may be. */
export const checkContent = (content: string): Outcome<string, PublicApiErrorCode> =>
    content.length > SOURCE_CHARS_MAX ? refused(PublicApiErrorCode.ContentTooLong, { max: SOURCE_CHARS_MAX }) : ok(content)
