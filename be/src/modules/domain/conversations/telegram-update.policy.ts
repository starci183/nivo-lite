import { isRecord, ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { TelegramInbound } from "./conversations.contracts"
import { ConversationsErrorCode } from "./errors/conversations.error"
import { numberField, readJsonObject, textField } from "./inbound-body.policy"

/** The name of a Telegram customer: first and last name, else the @username, else the channel name. */
const visitorOf = (from: unknown): string => {
    const name = [textField(from, "first_name"), textField(from, "last_name")].filter((part) => part !== "").join(" ")
    if (name !== "") return name
    const username = textField(from, "username")
    return username === "" ? "Telegram" : `@${username}`
}

/**
 * The customer message of one Telegram update, or a refusal for anything the chat does not answer (an edited message, a join, no text). A photo
 * (a transfer screenshot) arrives without text: it is read as what the customer says with it, `photoLabel` plus the caption.
 */
export const readTelegramUpdate = (
    photoLabel: string,
    raw?: Buffer,
): Outcome<TelegramInbound, ConversationsErrorCode> => {
    const body = readJsonObject(raw)
    if (body.kind !== "ok") return body
    const message = body.value.message
    const updateId = numberField(body.value, "update_id")
    const messageId = numberField(message, "message_id")
    const chatId = isRecord(message) ? numberField(message.chat, "id") : Number.NaN
    if (!isRecord(message) || Number.isNaN(updateId) || Number.isNaN(messageId) || Number.isNaN(chatId)) {
        return refused(ConversationsErrorCode.NotAnswered)
    }
    const hasPhoto = Array.isArray(message.photo) && message.photo.length > 0
    const caption = textField(message, "caption").trim()
    const written = textField(message, "text")
    const text = written === "" && hasPhoto ? [photoLabel, caption].filter(Boolean).join(" ") : written
    if (text === "") return refused(ConversationsErrorCode.NotAnswered)
    return ok({
        updateId,
        chatId: String(chatId),
        messageId,
        text: text.trim(),
        visitor: visitorOf(message.from),
        isStart: text.trim().startsWith("/start"),
    })
}
