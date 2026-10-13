import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the Telegram integration. */
export enum TelegramErrorCode {
    /** The Bot API could not be reached or did not answer in time. */
    Unavailable = "TELEGRAM_UNAVAILABLE",
    /** The Bot API answered and refused the call (the reason rides in the params). */
    Rejected = "TELEGRAM_REJECTED",
}

/** How each Telegram code travels. */
export const TELEGRAM_ERROR_KINDS: Record<TelegramErrorCode, ErrorKind> = {
    [TelegramErrorCode.Unavailable]: "unavailable",
    [TelegramErrorCode.Rejected]: "unavailable",
}

/** The one error class of the Telegram integration. */
export class TelegramError extends DomainError<TelegramErrorCode> {}
