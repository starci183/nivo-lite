import type { AccountDataInput } from "@modules/domain/account-data"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { CUSTOMER_MESSAGE_EVENTS, zaloEventKeyOf } from "./zalo-delivery-id.policy"
import { zaloEvent, zaloMessage, zaloUser } from "./zalo.data-types"
import type { ZaloEventSource } from "./zalo-inbox.contracts"

/** A string or number field of a JSON object as text, or an empty text. */
const scalarOf = (source: unknown, key: string): string => {
    const value: unknown = isRecord(source) ? source[key] : undefined
    return typeof value === "string" || typeof value === "number" ? String(value) : ""
}

/** The time of an event (`timestamp`, epoch milliseconds as Zalo sends it), or `now` when it carries none. */
const timeOf = (body: unknown, now: Date): Date => {
    const millis = Number(scalarOf(body, "timestamp"))
    return Number.isFinite(millis) && millis > 0 ? new Date(millis) : now
}

/** The follow state an exact event name sets, or undefined for any other event. */
const followedBy = (event: string): boolean | undefined => {
    if (event === "follow") return true
    return event === "unfollow" ? false : undefined
}

/**
 * What the account keeps of a delivery body, untouched: the parsed JSON when the body is a JSON object (every Zalo event is), else
 * `{ text: <the body as UTF-8> }`, so a body that is no object still has one stored form (the consumer reads it as no event).
 */
export const zaloRawOf = (rawBody: Buffer): object => {
    const text = rawBody.toString("utf8")
    const read = parseJsonText(text)
    return read.ok && isRecord(read.value) && !Array.isArray(read.value) ? read.value : { text }
}

/** The bytes a stored raw body is read again from: its JSON text, or nothing for a value that is no object. */
export const zaloBodyOf = (raw: unknown): Buffer => Buffer.from(isRecord(raw) ? JSON.stringify(raw) : "", "utf8")

/**
 * The event row of one delivery: keyed as `zaloEventKeyOf` keys it, its exact `event_name` beside it, `source` naming the door when it was
 * not the webhook (`poll`, `manual_import`).
 */
export const zaloEventRowsOf = (rawBody: Buffer, source?: ZaloEventSource): ReadonlyArray<AccountDataInput> => {
    const raw = zaloRawOf(rawBody)
    const event = scalarOf(raw, "event_name")
    return [
        {
            type: zaloEvent.name,
            value: {
                eventId: zaloEventKeyOf(rawBody),
                ...(event === "" ? {} : { event }),
                ...(source === undefined ? {} : { source }),
                raw,
            },
        },
    ]
}

/**
 * What the account keeps of one Zalo event beside it, read from its exact fields: a customer message (`user_send_text`, `user_send_image`,
 * `user_send_file`) keeps the message (`zalo_oa.message`, by `message.msg_id`) and the person (`zalo_oa.user`, by `sender.id`); a `follow` /
 * `unfollow` keeps the person with their follow state (by `follower.id`, else `sender.id`). Any other event keeps nothing. `name` is the
 * person's name when the caller knows it (Zalo's webhook carries none); `now` dates an event that carries no time.
 */
export const zaloDerivedRowsOf = (raw: unknown, now: Date, name = ""): ReadonlyArray<AccountDataInput> => {
    const event = scalarOf(raw, "event_name")
    const named = name === "" ? {} : { name }
    const followed = followedBy(event)
    if (followed !== undefined) {
        const person =
            scalarOf(isRecord(raw) ? raw.follower : undefined, "id") || scalarOf(isRecord(raw) ? raw.sender : undefined, "id")
        if (person === "") return []
        return [{ type: zaloUser.name, value: { userId: person, ...named, followed, lastEvent: event } }]
    }
    if (!CUSTOMER_MESSAGE_EVENTS.has(event)) return []
    const sender = scalarOf(isRecord(raw) ? raw.sender : undefined, "id")
    const message: unknown = isRecord(raw) ? raw.message : undefined
    const msgId = scalarOf(message, "msg_id")
    if (sender === "" || msgId === "") return []
    return [
        {
            type: zaloMessage.name,
            value: {
                msgId,
                userId: sender,
                direction: "in",
                text: scalarOf(message, "text"),
                at: timeOf(raw, now).toISOString(),
            },
        },
        { type: zaloUser.name, value: { userId: sender, ...named, lastEvent: event } },
    ]
}

/**
 * A person's row as the newest event names them over what the account already kept of them: a name or a follow state the new event does
 * not carry stays (a message names no follow state; the webhook names nobody).
 */
export const mergedZaloUserOf = (
    stored: Readonly<Record<string, unknown>> | null,
    next: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
    const name = stored?.name
    const followed = stored?.followed
    return {
        ...(typeof name === "string" && name !== "" ? { name } : {}),
        ...(typeof followed === "boolean" ? { followed } : {}),
        ...next,
    }
}
