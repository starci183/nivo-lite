import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { z } from "zod"
import type {
    DeclaredLine,
    OptionalCanonicalEvent,
    TriggerDeclaration,
    TriggerOrigin,
} from "@modules/domain/provider-triggers"

/*
 * THE TELEGRAM BOT'S MESSAGE TRIGGER (stage 1 of the one event pipeline, concept triggers rule 13): a message a person sends the bot, as
 * ONE canonical event. Pure: the translate reads only its argument. What counts as a message is what the conversation intake answered: an
 * update with a `message` that has an id, a chat and words (a text, or a photo / an image or PDF sent as a file, read as the photo label with
 * its caption); an edited message, a join, a message with no words are dropped. `/start` is a message like any other: its text says
 * `/start` and the package's first node reads it (the trigger carries no start flag).
 */

/** The trigger's name inside the provider. */
export const TELEGRAM_MESSAGE_RECEIVED = "message.received"

/** The channel of a Telegram person's identity. */
export const TELEGRAM_CHANNEL = "telegram"

/**
 * The words a photo with no text is read as, in the shop's language (Vietnamese, as the wake's words always were): the conversations
 * bundle's `conversations.photoSent` in brackets. A constant of the provider, so the translate stays pure.
 */
export const TELEGRAM_PHOTO_LABEL = "[Kh\u00e1ch g\u1eedi m\u1ed9t \u1ea3nh]"

/** A picture or file of a Telegram message as the update names it: no address yet, only the id `getFile` turns into one. */
export interface TelegramMessageFile {
    /** `image` for a photo or an image sent as a file, `file` for a PDF. */
    readonly kind: "image" | "file"
    /** Telegram's `file_id`. */
    readonly fileId: string
    /** The file name the sender gave, or an empty text (a photo has none). */
    readonly name: string
    /** The size in bytes Telegram gave, or null. */
    readonly size: number | null
}

/** The data of one Telegram message (the channel message members of every channel, plus the provider's attachments). */
export type TelegramMessageData = {
    /** The key the line is stored once under: `tg:<connection>:<chat id>:<message id>` (a message id is unique only inside its bot's chat). */
    readonly messageKey: string
    /** What the person wrote, or the photo label with its caption. */
    readonly text: string
    /** When it was sent (ISO 8601, the message `date`), or null when the update carries none. */
    readonly at: string | null
    /** The pictures and files sent with it, by Telegram's file id (the entry asks `getFile` and keeps the bytes); empty for a text. */
    readonly attachments: ReadonlyArray<TelegramMessageFile>
    /** Set only on the engine's release delivery of the channel verb (`held`): no new words. */
    readonly resume?: "held" | undefined
}

/** The `telegram.update` row the webhook kept: the update untouched in `raw`. The translate's raw. */
export interface TelegramUpdateRow {
    /** Telegram's `update_id`, as the row keys it. */
    readonly updateId: string
    /** The update Telegram posted, as JSON. */
    readonly raw: Readonly<Record<string, unknown>>
}

/** True for a JSON object (an array included, as the platform primitive reads it): the translate names no other piece. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null

/** A text field of an object, or an empty text. */
const textOf = (source: unknown, name: string): string => {
    const value = isRecord(source) ? source[name] : undefined
    return typeof value === "string" ? value : ""
}

/** A finite number field of an object, or NaN. */
const numberOf = (source: unknown, name: string): number => {
    const value = isRecord(source) ? source[name] : undefined
    return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN
}

/** A list field of an object, or an empty list. */
const listOf = (source: unknown, name: string): ReadonlyArray<unknown> => {
    const value = isRecord(source) ? source[name] : undefined
    return Array.isArray(value) ? value : []
}

/** The name the payload gives the person: first and last name, else the @username; absent when it gives neither. */
const nameOf = (from: unknown): string => {
    const name = [textOf(from, "first_name"), textOf(from, "last_name")].filter((part) => part !== "").join(" ")
    if (name !== "") return name
    const username = textOf(from, "username")
    return username === "" ? "" : `@${username}`
}

/** The size Telegram gave for a file, or null. */
const sizeOf = (file: unknown): number | null => {
    const size = numberOf(file, "file_size")
    return Number.isNaN(size) ? null : size
}

/** The pixels of one PhotoSize; 0 when Telegram gave none. */
const areaOf = (size: unknown): number => {
    const area = numberOf(size, "width") * numberOf(size, "height")
    return Number.isNaN(area) ? 0 : area
}

/** The largest size of a photo (the area decides, then the bytes: the docs promise no order), as one picture. */
const photoOf = (sizes: ReadonlyArray<unknown>): ReadonlyArray<TelegramMessageFile> => {
    const usable = sizes.filter((size) => textOf(size, "file_id") !== "")
    const [largest] = [...usable].sort(
        (left, right) => areaOf(right) - areaOf(left) || (sizeOf(right) ?? 0) - (sizeOf(left) ?? 0),
    )
    if (largest === undefined) return []
    return [{ kind: "image", fileId: textOf(largest, "file_id"), name: "", size: sizeOf(largest) }]
}

/** What the shop reads a document as by its declared type: a picture, a PDF, or nothing. */
const documentKindOf = (type: string): TelegramMessageFile["kind"] | null => {
    if (type.startsWith("image/")) return "image"
    return type === "application/pdf" ? "file" : null
}

/** A document the shop can read: a picture sent as a file or a PDF; anything else is no customer file. */
const documentOf = (document: unknown): ReadonlyArray<TelegramMessageFile> => {
    const fileId = textOf(document, "file_id")
    const kind = documentKindOf(textOf(document, "mime_type").toLowerCase())
    if (fileId === "" || kind === null) return []
    return [{ kind, fileId, name: textOf(document, "file_name"), size: sizeOf(document) }]
}

/** The time of a message (`date`, Unix seconds) as ISO 8601, or null. */
const atOf = (message: unknown): string | null => {
    const seconds = numberOf(message, "date")
    return Number.isNaN(seconds) || seconds <= 0 ? null : new Date(seconds * 1000).toISOString()
}

/** The translate: the message of one stored update on its bot's account, or null for anything the chat does not answer. */
export const translateTelegramUpdateRow = (
    row: TelegramUpdateRow,
    origin: TriggerOrigin,
): OptionalCanonicalEvent<TelegramMessageData> => {
    const message = row.raw.message
    const updateId = numberOf(row.raw, "update_id")
    const messageId = numberOf(message, "message_id")
    const chatId = isRecord(message) ? numberOf(message.chat, "id") : Number.NaN
    if (!isRecord(message) || Number.isNaN(updateId) || Number.isNaN(messageId) || Number.isNaN(chatId)) return null
    const hasPhoto = Array.isArray(message.photo) && message.photo.length > 0
    const files = [...photoOf(listOf(message, "photo")), ...documentOf(message.document)]
    const caption = textOf(message, "caption").trim()
    const written = textOf(message, "text")
    const text =
        written === "" && (hasPhoto || files.length > 0)
            ? [TELEGRAM_PHOTO_LABEL, caption].filter(Boolean).join(" ")
            : written
    if (text === "") return null
    const name = nameOf(message.from)
    const chat = String(chatId)
    return {
        id: String(updateId),
        subject: { channel: TELEGRAM_CHANNEL, id: chat, ...(name === "" ? {} : { name }) },
        data: {
            messageKey: `tg:${origin.connectionId ?? ""}:${chat}:${String(messageId)}`,
            text: text.trim(),
            at: atOf(message),
            attachments: files,
        },
    }
}

/** The data schema of a Telegram message. */
const TELEGRAM_MESSAGE_DATA: z.ZodType<TelegramMessageData> = z.object({
    messageKey: z.string(),
    text: z.string(),
    at: z.string().nullable(),
    attachments: z.array(
        z.object({
            kind: z.enum(["image", "file"]),
            fileId: z.string(),
            name: z.string(),
            size: z.number().nullable(),
        }),
    ),
    resume: z.literal("held").optional(),
})

/** The raw schema: the stored `telegram.update` row value. */
const TELEGRAM_UPDATE_ROW: z.ZodType<TelegramUpdateRow> = z.object({
    updateId: z.string().min(1),
    raw: z.record(z.string(), z.unknown()),
})

/** A customer line settles: the run starts once the person has been quiet for 6 s, 20 s after their first line at most (customer-messages rule 13). */
const CHAT_SETTLE = { windowMs: 6000, maxWaitMs: 20_000 } as const

/** The message trigger as the bot's webhook receives it. */
/**
 * The line the person said, as the engine keeps it on the route (owner ruling R26): the message key, the words, the channel's time. The
 * release door's delivery carries no key and is no line. A `/start` is a line: it is what the person sent. Pure.
 */
export const telegramLineOf = (data: TelegramMessageData): DeclaredLine | null =>
    data.messageKey === "" ? null : { key: data.messageKey, text: data.text, at: data.at }

export const TELEGRAM_MESSAGE_WEBHOOK: TriggerDeclaration<TelegramUpdateRow, TelegramMessageData> = {
    provider: PROVIDER.telegram,
    name: TELEGRAM_MESSAGE_RECEIVED,
    verb: TRIGGER.telegramMessageReceived,
    via: "webhook",
    raw: TELEGRAM_UPDATE_ROW,
    data: TELEGRAM_MESSAGE_DATA,
    translate: translateTelegramUpdateRow,
    line: telegramLineOf,
    key: { by: "subject" },
    settle: CHAT_SETTLE,
}

/** Every trigger the Telegram provider declares. */
export const TELEGRAM_TRIGGERS: ReadonlyArray<TriggerDeclaration<TelegramUpdateRow, TelegramMessageData>> = [
    TELEGRAM_MESSAGE_WEBHOOK,
]
