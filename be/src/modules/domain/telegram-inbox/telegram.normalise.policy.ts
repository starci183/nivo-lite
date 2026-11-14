import type { AccountDataInput } from "@modules/domain/account-data"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { telegramMessage, telegramUpdate, telegramUser } from "./telegram.data-types"
import type { OptionalTelegramSender, TelegramMessageRead, TelegramSender } from "./telegram-inbox.contracts"

/** A text field of a JSON object, or an empty text. */
const textOf = (source: unknown, key: string): string => {
    const value: unknown = isRecord(source) ? source[key] : undefined
    return typeof value === "string" ? value : ""
}

/** A string or whole-number field of a JSON object as text, or an empty text. */
const idOf = (source: unknown, key: string): string => {
    const value: unknown = isRecord(source) ? source[key] : undefined
    if (typeof value === "string") return value
    return typeof value === "number" && Number.isInteger(value) ? String(value) : ""
}

/**
 * What the account keeps of a delivery body, untouched: the parsed JSON object (every Telegram update is one); null for a body that is no
 * JSON object, which is no update and is never kept.
 */
export const telegramRawOf = (rawBody: Buffer): Readonly<Record<string, unknown>> | null => {
    const read = parseJsonText(rawBody.toString("utf8"))
    return read.ok && isRecord(read.value) && !Array.isArray(read.value) ? read.value : null
}

/** The bytes a stored raw body is read again from: its JSON text, or nothing for a value that is no object. */
export const telegramBodyOf = (raw: unknown): Buffer => Buffer.from(isRecord(raw) ? JSON.stringify(raw) : "", "utf8")

/** The update row of a webhook delivery, keyed by the exact `update_id`; nothing for a body that names none. */
export const telegramUpdateRowsOf = (rawBody: Buffer): ReadonlyArray<AccountDataInput> => {
    const raw = telegramRawOf(rawBody)
    const updateId = idOf(raw, "update_id")
    if (raw === null || updateId === "") return []
    return [{ type: telegramUpdate.name, value: { updateId, raw } }]
}

/**
 * The person who sent the message of a Telegram update, read from the exact fields `message.from.id`, `message.from.username`,
 * `message.from.first_name` and `message.from.last_name`; null for an update that is not a message or a message with no sender (a channel
 * post).
 */
export const telegramSenderOf = (raw: unknown): OptionalTelegramSender => {
    const message: unknown = isRecord(raw) ? raw.message : undefined
    const from: unknown = isRecord(message) ? message.from : undefined
    const userId = idOf(from, "id")
    if (userId === "") return null
    const username = textOf(from, "username")
    const sender: TelegramSender = {
        userId,
        username: (username.startsWith("@") ? username.slice(1) : username).toLowerCase(),
        firstName: textOf(from, "first_name"),
        lastName: textOf(from, "last_name"),
    }
    return sender
}

/** The members of a value whose text is not empty. */
const filled = (members: Readonly<Record<string, string>>): Readonly<Record<string, string>> =>
    Object.fromEntries(Object.entries(members).filter((entry) => entry[1] !== ""))

/**
 * What the account keeps of one Telegram customer message, beside its update: the message (`telegram.message`, by `<chat id>:<message_id>`)
 * and the person (`telegram.user`, by their Telegram user id). Nothing for a message with no sender. `now` dates a message the update carries
 * no time for.
 */
export const telegramMessageRowsOf = (
    raw: unknown,
    inbound: TelegramMessageRead,
    now: Date,
): ReadonlyArray<AccountDataInput> => {
    const sender = telegramSenderOf(raw)
    if (sender === null) return []
    const at = inbound.sentAt === null ? now : new Date(inbound.sentAt)
    const named = filled({ username: sender.username })
    return [
        {
            type: telegramMessage.name,
            value: {
                chatId: inbound.chatId,
                messageId: String(inbound.messageId),
                userId: sender.userId,
                ...named,
                direction: "in",
                text: inbound.text,
                at: at.toISOString(),
            },
        },
        {
            type: telegramUser.name,
            value: {
                userId: sender.userId,
                ...filled({ username: sender.username, firstName: sender.firstName, lastName: sender.lastName }),
                chatId: inbound.chatId,
            },
        },
    ]
}
