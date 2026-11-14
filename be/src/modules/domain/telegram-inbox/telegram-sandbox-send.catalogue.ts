import type { SandboxCase } from "@modules/domain/provider-sandbox"

/** The operation of the customer send in the sandbox call log and in the account's next-case selector. */
export const TELEGRAM_SEND_OPERATION = "send"

/** The operation of the staff send (a text to a member of the team through the bot). */
export const TELEGRAM_STAFF_OPERATION = "sendToPerson"

/** The operation of "typing" in the person's chat; it has no case (it always shows). */
export const TELEGRAM_TYPING_OPERATION = "showTyping"

/**
 * The outbound cases of the Telegram customer send (R62: the account's NEXT CASE picks one, sticky; TELEGRAM-SEND-1 answers while nothing
 * is picked). Telegram has NO reply window: no case depends on how long ago the person wrote.
 */
export const TELEGRAM_SEND_SANDBOX_CASES: ReadonlyArray<SandboxCase> = [
    {
        id: "TELEGRAM-SEND-1",
        label: "The send is delivered: Telegram accepts the text (and the pictures that follow it)",
        operation: TELEGRAM_SEND_OPERATION,
        default: true,
    },
    {
        id: "TELEGRAM-SEND-2",
        label: "The send is refused by Telegram (a blocked bot): the typed refusal TELEGRAM_REJECTED, a definite not-delivered receipt",
        operation: TELEGRAM_SEND_OPERATION,
    },
    {
        id: "TELEGRAM-SEND-3",
        label: "The send times out: Telegram never answers, so the outcome is unknown (ambiguous receipt)",
        operation: TELEGRAM_SEND_OPERATION,
    },
]

/**
 * The outbound cases of the staff send: TELEGRAM-STAFF-1 answers while nothing is picked; TELEGRAM-STAFF-2 throws what the live route
 * throws when the bot of the connection is gone.
 */
export const TELEGRAM_STAFF_SANDBOX_CASES: ReadonlyArray<SandboxCase> = [
    {
        id: "TELEGRAM-STAFF-1",
        label: "The staff text is sent: Telegram accepts it (nothing is returned)",
        operation: TELEGRAM_STAFF_OPERATION,
        default: true,
    },
    {
        id: "TELEGRAM-STAFF-2",
        label: "The staff text is refused: the connection's bot is gone (CHANNELS_CONNECTION_NOT_FOUND)",
        operation: TELEGRAM_STAFF_OPERATION,
    },
]
