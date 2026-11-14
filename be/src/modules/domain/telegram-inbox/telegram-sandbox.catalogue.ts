import type {
    SandboxCase,
    SandboxCatalogue,
    SandboxInboundCase,
    SandboxInboundContext,
    SandboxInput,
    SandboxInputField,
    SandboxWebhookEvent,
} from "@modules/domain/provider-sandbox"
import { TELEGRAM_PROVIDER } from "./telegram.data-types"

/** The provider key of the Telegram bot catalogue: `connections.provider` names it so. */
export const TELEGRAM_SANDBOX_PROVIDER = TELEGRAM_PROVIDER

/** The `update_id` of a sandbox account's inbound sends counts on from here: its n-th inbound send posts `TELEGRAM_SANDBOX_UPDATE_BASE + n`. */
export const TELEGRAM_SANDBOX_UPDATE_BASE = 700_000_000

/** The name Telegram gives the customer of the sandbox bot (`from.first_name`, `chat.first_name`). */
export const TELEGRAM_SANDBOX_CUSTOMER_NAME = "Khach Sandbox"

/** The webhook route of a Telegram bot on NIVO for one account. */
const telegramRoute = (connectionId: string): string => `api/telegram/${connectionId}`

/** The input naming the chat of the person (TELEGRAM-1 and TELEGRAM-2): Telegram's own chat id, an integer. */
const CHAT_FIELD: SandboxInputField = {
    name: "chatId",
    label: "Chat id của khách / Chat id of the person",
    kind: "integer",
    example: 700100200,
}

/** The input holding the line the person writes (TELEGRAM-1). */
const TEXT_FIELD: SandboxInputField = {
    name: "text",
    label: "Nội dung tin / Message text",
    kind: "text",
    example: "Chao shop, cho minh hoi gia bo hoa hong do nhe",
}

/** The chat id as Telegram posts it: a whole number when the input is one, else the text as given. */
const chatIdOf = (input: SandboxInput): number | string => {
    const value = input.chatId
    const number = typeof value === "number" ? value : Number(value)
    return Number.isSafeInteger(number) ? number : String(value ?? "")
}

/** The two sizes of a Telegram photo (`message.photo`: a small and a large `PhotoSize`, ids running with the update). */
const photoSizesOf = (running: number): ReadonlyArray<Readonly<Record<string, unknown>>> => [
    { file_id: `sbx-photo-${String(running)}-s`, file_unique_id: `sbx-u-${String(running)}-s`, file_size: 1_240, width: 90, height: 90 },
    { file_id: `sbx-photo-${String(running)}-l`, file_unique_id: `sbx-u-${String(running)}-l`, file_size: 48_600, width: 1_280, height: 960 },
]

/**
 * One Telegram inbound case: a person's message becomes ONE update as the Bot API posts it (`update_id` running from the account's
 * inbound sends, `message.date` the sender's moment in seconds, a `text`, or a `photo` array and no text). Telegram has no reply window,
 * so nothing is kept in the account's state: a bot may write to a chat that has written to it at any time.
 */
const caseOf = (kind: "text" | "photo", inputs: ReadonlyArray<SandboxInputField>): SandboxInboundCase => ({
    trigger: "message.received",
    path: telegramRoute,
    inputs,
    eventsOf: (input: SandboxInput, context: SandboxInboundContext): Promise<ReadonlyArray<SandboxWebhookEvent>> => {
        const running = context.state.seq + 1
        const chatId = chatIdOf(input)
        const body = {
            update_id: TELEGRAM_SANDBOX_UPDATE_BASE + running,
            message: {
                message_id: running,
                from: { id: chatId, is_bot: false, first_name: TELEGRAM_SANDBOX_CUSTOMER_NAME, language_code: "vi" },
                chat: { id: chatId, first_name: TELEGRAM_SANDBOX_CUSTOMER_NAME, type: "private" },
                date: Math.floor(context.at.getTime() / 1000),
                ...(kind === "photo" ? { photo: photoSizesOf(running) } : { text: typeof input.text === "string" ? input.text : "" }),
            },
        }
        return Promise.resolve([{ body }])
    },
})

/**
 * Telegram bot's hardcoded sandbox cases (owner ruling R62): two inbound TRANSFORMATIONS of `{ chatId, text }` / `{ chatId }` into the
 * update Telegram posts on `api/telegram/<connectionId>` (a text line, a picture with no text: Telegram's `message.photo`, no text), with
 * no window case because Telegram has no reply window. The customer SEND, the staff text and "typing" answer from
 * `telegram-sandbox-send.catalogue.ts` (TELEGRAM-SEND-1..3, TELEGRAM-STAFF-1..2).
 */
export const TELEGRAM_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: TELEGRAM_SANDBOX_PROVIDER,
    cases: [
        {
            id: "TELEGRAM-1",
            label: "A person writes the bot a text line: a message update with its text, dated at the send",
            inbound: caseOf("text", [CHAT_FIELD, TEXT_FIELD]),
        },
        {
            id: "TELEGRAM-2",
            label: "A person sends the bot a picture and no text: a message update with a photo array and no text",
            inbound: caseOf("photo", [CHAT_FIELD]),
        },
    ] satisfies ReadonlyArray<SandboxCase>,
}
