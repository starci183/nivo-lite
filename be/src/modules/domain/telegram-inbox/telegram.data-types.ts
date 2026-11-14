import { defineAccountDataType, type AccountDataTypeDef } from "@modules/domain/account-data"

/** The provider of a Telegram bot connection, as `connections.provider` names it. */
export const TELEGRAM_PROVIDER = "telegram"

/**
 * The names of the credentials a Telegram connection holds (the bot token, the secret-token header of its webhook), in every spelling the
 * code and Telegram's API use: no value of a Telegram type may carry a member of these names.
 */
const TELEGRAM_SECRET_FIELDS: ReadonlyArray<string> = [
    "bot_token",
    "botToken",
    "secret_token",
    "webhook_secret",
    "webhookSecret",
]

/** The longest text of a message the account keeps: Telegram's 4096 characters of a text, with room for the photo label of a caption. */
const MESSAGE_TEXT_MAX = 8192

/**
 * One update of the bot's webhook, as Telegram sent it, keyed by its `update_id`: the work row of the consumer (pending until the message
 * is stored and answered), swept 30 days after it was processed.
 */
export const telegramUpdate: AccountDataTypeDef = defineAccountDataType({
    name: "telegram.update",
    provider: TELEGRAM_PROVIDER,
    version: 1,
    write: "append",
    fields: {
        updateId: { type: "text", required: true, maxLength: 40 },
        raw: { type: "json", required: true },
    },
    key: ["updateId"],
    wakes: true,
    retention: { days: 30 },
    indexes: [],
    secretFields: TELEGRAM_SECRET_FIELDS,
    purpose: "chat.event",
})

/** One customer message of a chat with the bot, keyed by `<chat id>:<message_id>`, kept for good. */
export const telegramMessage: AccountDataTypeDef = defineAccountDataType({
    name: "telegram.message",
    provider: TELEGRAM_PROVIDER,
    version: 1,
    write: "append",
    fields: {
        chatId: { type: "text", required: true, maxLength: 40 },
        messageId: { type: "text", required: true, maxLength: 40 },
        userId: { type: "text", required: true, maxLength: 40 },
        username: { type: "text", required: false, maxLength: 64 },
        direction: { type: "text", required: true, maxLength: 3 },
        text: { type: "text", required: true, maxLength: MESSAGE_TEXT_MAX },
        at: { type: "timestamp", required: true },
    },
    key: ["chatId", "messageId"],
    occurredAt: "at",
    wakes: false,
    retention: "keep",
    indexes: [
        { name: "username", on: ["username"] },
        { name: "chat_id", on: ["chatId"] },
    ],
    secretFields: TELEGRAM_SECRET_FIELDS,
    purpose: "chat.message",
})

/** The person behind a Telegram user id as their latest message names them, keyed by the user id, kept for good. */
export const telegramUser: AccountDataTypeDef = defineAccountDataType({
    name: "telegram.user",
    provider: TELEGRAM_PROVIDER,
    version: 1,
    write: "overwrite",
    fields: {
        userId: { type: "text", required: true, maxLength: 40 },
        username: { type: "text", required: false, maxLength: 64 },
        firstName: { type: "text", required: false, maxLength: 256 },
        lastName: { type: "text", required: false, maxLength: 256 },
        chatId: { type: "text", required: true, maxLength: 40 },
    },
    key: ["userId"],
    wakes: false,
    retention: "keep",
    indexes: [{ name: "username", on: ["username"] }],
    secretFields: TELEGRAM_SECRET_FIELDS,
    purpose: "chat.contact",
})

/** Every account data type of a Telegram connection, for the catalog. */
export const TELEGRAM_DATA_TYPES: ReadonlyArray<AccountDataTypeDef> = [telegramUpdate, telegramMessage, telegramUser]
