
export { TELEGRAM_DELIVERY_QUEUE } from "@modules/queues/telegram-delivery"
export type { TelegramDeliveryRecorded } from "@modules/queues/telegram-delivery"

/** The transport may have no retained raw bytes. */
export type TelegramRawDelivery = Buffer | undefined

/** The customer message of one Telegram update, as the account keeps it beside the update: its chat, its id, its words and its time. */
export interface TelegramMessageRead {
    /** The chat the message is in (the person's id on the bot). */
    readonly chatId: string
    /** The message id inside the chat. */
    readonly messageId: number
    /** What the person wrote, or the photo label with its caption. */
    readonly text: string
    /** When it was sent, epoch milliseconds, or null when the update carries none. */
    readonly sentAt: number | null
}

/** A picture or file of a Telegram message with the address the shop reads it from once; an empty address when Telegram gave none. */
export interface TelegramFileAddress {
    /** `image` or `file`. */
    readonly kind: "image" | "file"
    /** The download address (it carries the bot token: it only goes to the guarded file fetch). */
    readonly url: string
    /** The file name the sender gave, or an empty text. */
    readonly name: string
}

/** The customer message of an update, or null for an update the chat does not answer. */
export type OptionalTelegramMessageRead = TelegramMessageRead | null

/** The person who sent a Telegram message, as the update names them; an empty text for what the update leaves out. */
export interface TelegramSender {
    /** The Telegram user id, as text. */
    readonly userId: string
    /** The @username, lower-case and without the "@"; empty when the person has none. */
    readonly username: string
    /** The first name. */
    readonly firstName: string
    /** The last name. */
    readonly lastName: string
}

/** The sender of a message, or null for an update that is not a message or names no sender. */
export type OptionalTelegramSender = TelegramSender | null
