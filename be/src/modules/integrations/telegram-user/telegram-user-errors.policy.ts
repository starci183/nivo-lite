import { isRecord } from "@modules/platform/primitives"
import { TELEGRAM_USER_TEXT } from "./messages/telegram-user.messages"

/** The message shown when Telegram has ended the session. */
export const TELEGRAM_REVOKED_MESSAGE: string = TELEGRAM_USER_TEXT.revoked

/** The message shown when the deployment has no Telegram app credentials. */
export const TELEGRAM_NOT_CONFIGURED_MESSAGE: string = TELEGRAM_USER_TEXT.notConfigured

/** Telegram says the session is gone (signed out in Devices, account deleted or banned). */
const REVOKED = new Set([
    "AUTH_KEY_UNREGISTERED",
    "SESSION_REVOKED",
    "SESSION_EXPIRED",
    "USER_DEACTIVATED",
    "USER_DEACTIVATED_BAN",
    "AUTH_KEY_INVALID",
    "AUTH_KEY_DUPLICATED",
])

/** The Telegram error code (or the message) of a thrown value; empty when it has none. */
export const telegramErrorCode = (error: unknown): string => {
    if (!isRecord(error)) return ""
    if (typeof error.errorMessage === "string") return error.errorMessage
    return typeof error.message === "string" ? error.message : ""
}

/** True when Telegram says the session no longer exists. */
export const isTelegramRevoked = (error: unknown): boolean => REVOKED.has(telegramErrorCode(error))

/** The plain-language sentence for a known Telegram code, or null when the code is not one the owner can act on. */
const knownSentence = (code: string): string | null => {
    if (/^PHONE_CODE_INVALID|^PHONE_CODE_EMPTY/u.test(code)) return TELEGRAM_USER_TEXT.codeInvalid
    if (/^PHONE_CODE_EXPIRED/u.test(code)) return TELEGRAM_USER_TEXT.codeExpired
    if (/^PASSWORD_HASH_INVALID/u.test(code)) return TELEGRAM_USER_TEXT.passwordInvalid
    if (/^PHONE_NUMBER_INVALID/u.test(code)) return TELEGRAM_USER_TEXT.phoneInvalid
    if (/^PHONE_NUMBER_BANNED/u.test(code)) return TELEGRAM_USER_TEXT.phoneBanned
    if (/^PHONE_NUMBER_FLOOD|^FLOOD|^SEND_CODE_UNAVAILABLE/u.test(code)) return TELEGRAM_USER_TEXT.flood
    if (REVOKED.has(code)) return TELEGRAM_USER_TEXT.revoked
    return null
}

/** Plain Vietnamese for what Telegram says. Unknown errors never echo internals. */
export const explainTelegramError = (error: unknown): string =>
    knownSentence(telegramErrorCode(error)) ?? TELEGRAM_USER_TEXT.unavailable

/** True when the error is one of the known, owner-fixable Telegram answers (not the generic fallback). */
export const isKnownTelegramError = (error: unknown): boolean => knownSentence(telegramErrorCode(error)) !== null
