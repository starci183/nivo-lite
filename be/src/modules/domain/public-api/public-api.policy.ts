import { createHash } from "node:crypto"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { PublicApiErrorCode } from "./errors/public-api.error"
import type { AcceptKnowledgeParams, AcceptLeadParams, LeadFacts, RequestKind } from "./public-api.contracts"

/** Characters of the text of one knowledge source. */
export const SOURCE_CHARS_MAX = 120_000

/** Tags kept on one knowledge source. */
export const TAGS_MAX = 12

/** A new customer's need when the API caller supplies none; historical rows used it as a sentinel. */
export const DEFAULT_API_NEED = "Created through the API"

/** The window of events read when the caller names none: one day. */
const EVENTS_DEFAULT_WINDOW_MS = 86_400_000

export { contactParts, normaliseContact } from "@modules/domain/leads"

/** The first part of the dedupe key of a request: its kind and the key that sent it. */
export const dedupePrefix = (kind: RequestKind, keyId: string): string => `${kind}:${keyId}:`

/** The last part of the dedupe key of a message: the same idempotency key and conversation is one message, whatever the retries; empty without an idempotency key. */
export const messageDedupeSuffix = (idempotencyKey: string | undefined, conversationId: string): string => {
    const key = idempotencyKey?.trim() ?? ""
    return key === "" ? "" : createHash("sha256").update(`${key}:${conversationId}`).digest("hex").slice(0, 24)
}

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
    content.length > SOURCE_CHARS_MAX
        ? refused(PublicApiErrorCode.ContentTooLong, { max: SOURCE_CHARS_MAX })
        : ok(content)

/** The channel a customer handed over without one is attributed to. */
const DEFAULT_CHANNEL = "API"

/** A page size as the caller wrote it: a number inside 1..max, the fallback when it is absent or not a number. */
export const clampLimit = (raw: string | undefined, fallback: number, max: number): number =>
    Math.min(max, Math.max(1, Number(raw) || fallback))

/** A hand-over with every absent text made empty, the channel defaulted and the stage decided. */
export const leadFacts = (params: AcceptLeadParams): LeadFacts => ({
    name: params.name,
    phone: params.phone ?? "",
    email: params.email ?? "",
    company: params.company ?? "",
    need: params.need ?? "",
    channel: params.channel || DEFAULT_CHANNEL,
    externalId: params.externalId ?? "",
    note: params.note ?? "",
    stage: params.stage || null,
})

/** The visibility of a knowledge source: public only when the caller said so. */
export const visibilityOf = (params: AcceptKnowledgeParams): "internal" | "public" =>
    params.visibility === "public" ? "public" : "internal"

/** Trims a string value and reads a number as its digits, as the public API always did; anything else is left alone. */
export const trimmedField = (value: unknown): unknown => {
    if (typeof value === "string") return value.trim()
    return typeof value === "number" ? String(value) : value
}
