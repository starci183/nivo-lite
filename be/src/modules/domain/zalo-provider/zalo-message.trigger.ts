import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import type { DeclaredLine, OptionalCanonicalEvent, TriggerDeclaration } from "@modules/domain/provider-triggers"
import { ZALO_ATTACHMENT_LABELS } from "./messages/zalo-trigger.messages"
import { ZALO_EVENT_ROW, ZALO_MESSAGE_DATA } from "./zalo-message.trigger.schema"

/*
 * THE ZALO OA'S MESSAGE TRIGGER (stage 1 of the one event pipeline, concept triggers rule 13): what a customer writes to the OA, as ONE
 * canonical event. It is received by the OA's webhook; the OA's poll reconciles what a webhook never delivered by keeping the same
 * `zalo_oa.event` row under the same key (the body the webhook would have posted), so both doors give one event. Pure: the translate reads
 * only its arguments. What counts as a message is Zalo's documented event names (`user_send_text`, `user_send_image`, `user_send_file`);
 * every other event (follow, seen, an OA message) is dropped, exactly as the conversation intake dropped it.
 */

/** The trigger's name inside the provider. */
export const ZALO_MESSAGE_RECEIVED = "message.received"

/** The channel of a Zalo customer's identity. */
export const ZALO_CHANNEL = "zalo"

/** The event of a customer writing text to the OA. */
const TEXT_EVENT = "user_send_text"

/** The events of a customer sending a picture or a file, with what the shop reads them as. */
const ATTACHMENT_EVENTS: ReadonlyMap<string, "image" | "file"> = new Map([
    ["user_send_image", "image"],
    ["user_send_file", "file"],
])

/** The door a stored event came by when it was not the webhook: a manual import may name a file of the import folder. */
const MANUAL_IMPORT = "manual_import"

/** One picture or file of a Zalo customer message, as Zalo sends it (`{ type, payload: { url, thumbnail, name } }`). */
export interface ZaloAttachment {
    /** `image` or `file`. */
    readonly kind: "image" | "file"
    /** The https address Zalo gives (it expires: the entry keeps the bytes before the delivery); empty for a file of a manual import. */
    readonly url: string
    /** The address of a smaller preview, or an empty text. */
    readonly thumbnailUrl: string
    /** The name the sender gave, or an empty text. */
    readonly name: string
    /** The path of a manual import inside the import folder; empty for any other source. */
    readonly localPath: string
}

/** The data of one Zalo customer message (the channel message members of every channel, plus the provider's attachments). */
export type ZaloMessageData = {
    /** The key the line is stored once under, the same for the webhook and the poll: `zalo:<msg_id>`. */
    readonly messageKey: string
    /** What the customer wrote as the turn reads it: the text, or the label of the picture or file with its caption after it. */
    readonly text: string
    /** When the customer sent it (ISO 8601), as the event says; null when the event carries no usable time. */
    readonly at: string | null
    /** The pictures and files sent with it, as Zalo names them; empty for a text. */
    readonly attachments: ReadonlyArray<ZaloAttachment>
    /** Set only on the engine's release delivery of the channel verb (`held`): no new words. */
    readonly resume?: "held" | undefined
}

/** A Zalo webhook body as JSON carries it: an object of any members, read only through the translate's own pieces. */
export type ZaloBody = Readonly<Record<string, unknown>>

/** The `zalo_oa.event` row the webhook, the poll or a manual import kept: the body untouched in `raw`. The translate's raw. */
export interface ZaloEventRow {
    /** The row's key. */
    readonly eventId: string
    /** Zalo's `event_name`, when the body names one. */
    readonly event?: string | undefined
    /** The door, when it was not the webhook (`poll`, `manual_import`). */
    readonly source?: string | undefined
    /** The body Zalo posted (or the poll made of a listed message), as JSON. */
    readonly raw: ZaloBody
}

/** True for a JSON object (an array included, as the platform primitive reads it): the translate names no other piece. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null

/** A text field of an object, or an empty text. */
const textOf = (source: unknown, name: string): string => {
    const value = isRecord(source) ? source[name] : undefined
    return typeof value === "string" ? value : ""
}

/** A list field of an object, or an empty list. */
const listOf = (source: unknown, name: string): ReadonlyArray<unknown> => {
    const value = isRecord(source) ? source[name] : undefined
    return Array.isArray(value) ? value : []
}

/** A time field in epoch milliseconds, given as a number or as its digits; null when it is missing or no positive time. */
const millisOf = (source: unknown, name: string): number | null => {
    const value = isRecord(source) ? source[name] : undefined
    const millis = typeof value === "string" && value.trim() !== "" ? Number(value) : value
    return typeof millis === "number" && Number.isFinite(millis) && millis > 0 ? millis : null
}

/** The attachments of a message; one with no address (and, for an import, no local path) is left out. */
const attachmentsOf = (
    message: unknown,
    kind: "image" | "file",
    allowLocalPath: boolean,
): ReadonlyArray<ZaloAttachment> =>
    listOf(message, "attachments").flatMap((item: unknown) => {
        const payload = isRecord(item) ? item.payload : undefined
        const url = textOf(payload, "url")
        const localPath = allowLocalPath ? textOf(item, "localPath") : ""
        if (url === "" && localPath === "") return []
        return [{ kind, url, thumbnailUrl: textOf(payload, "thumbnail"), name: textOf(payload, "name"), localPath }]
    })

/** The words the turn reads: the text, or the label of the first picture or file with the caption after it. */
const wordsOf = (text: string, attachments: ReadonlyArray<ZaloAttachment>): string => {
    const [first] = attachments
    return first === undefined ? text : `${ZALO_ATTACHMENT_LABELS[first.kind]} ${text}`.trim()
}

/**
 * The customer message of one Zalo body: text, or a picture or file with its caption. Null for any other event and for one that lacks the
 * sender, the message id, the text (of a text event) or any attachment with an address (of a picture or file event). Zalo's webhook names
 * no customer name or picture; a body the poll made of a listed message carries the name the listing shows as `sender.display_name`.
 */
export const zaloMessageOfBody = (
    body: ZaloBody,
    allowLocalPath: boolean = false,
): OptionalCanonicalEvent<ZaloMessageData> => {
    const name = textOf(body, "event_name")
    const userId = textOf(body.sender, "id")
    const messageId = textOf(body.message, "msg_id")
    const text = textOf(body.message, "text").trim()
    const sentAt = millisOf(body, "timestamp")
    if (userId === "" || messageId === "") return null
    const kind = ATTACHMENT_EVENTS.get(name)
    if (name !== TEXT_EVENT && kind === undefined) return null
    const attachments = kind === undefined ? [] : attachmentsOf(body.message, kind, allowLocalPath)
    if (kind === undefined ? text === "" : attachments.length === 0) return null
    const shown = textOf(body.sender, "display_name").trim()
    return {
        id: messageId,
        subject: { channel: ZALO_CHANNEL, id: userId, ...(shown === "" ? {} : { name: shown }) },
        data: {
            messageKey: `${ZALO_CHANNEL}:${messageId}`,
            text: wordsOf(text, attachments),
            at: sentAt === null ? null : new Date(sentAt).toISOString(),
            attachments,
        },
    }
}

/** The Zalo app a webhook body was sent for (`app_id`), or an empty text: what the entry's verify compares with the connection's app. */
export const zaloAppIdOf = (body: ZaloBody): string => textOf(body, "app_id")

/** The translate: the stored event row's message, files of the import folder allowed only for a manual import. */
export const translateZaloEventRow = (row: ZaloEventRow): OptionalCanonicalEvent<ZaloMessageData> =>
    zaloMessageOfBody(row.raw, row.source === MANUAL_IMPORT)

/** A customer line settles: the run starts once the person has been quiet for 6 s, 20 s after their first line at most (customer-messages rule 13). */
const CHAT_SETTLE = { windowMs: 6000, maxWaitMs: 20_000 } as const

/**
 * The line the person said, as the engine keeps it on the route (owner ruling R26): the message key, the words, the channel's time. The
 * release door's delivery carries no key and is no line. Pure.
 */
export const zaloLineOf = (data: ZaloMessageData): DeclaredLine | null =>
    data.messageKey === "" ? null : { key: data.messageKey, text: data.text, at: data.at }

/** The message trigger: received by the webhook, reconciled by the poll into the same row. */
export const ZALO_MESSAGE_TRIGGER: TriggerDeclaration<ZaloEventRow, ZaloMessageData> = {
    provider: PROVIDER.zaloOa,
    name: ZALO_MESSAGE_RECEIVED,
    verb: TRIGGER.zaloMessageReceived,
    via: "webhook",
    raw: ZALO_EVENT_ROW,
    data: ZALO_MESSAGE_DATA,
    translate: translateZaloEventRow,
    line: zaloLineOf,
    key: { by: "subject" },
    settle: CHAT_SETTLE,
}

/** Every trigger the Zalo OA provider declares. */
export const ZALO_TRIGGERS: ReadonlyArray<TriggerDeclaration<ZaloEventRow, ZaloMessageData>> = [ZALO_MESSAGE_TRIGGER]
