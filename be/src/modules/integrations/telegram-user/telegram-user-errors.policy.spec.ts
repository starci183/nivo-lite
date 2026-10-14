import { TELEGRAM_USER_TEXT } from "./messages/telegram-user.messages"
import {
    TELEGRAM_NOT_CONFIGURED_MESSAGE,
    TELEGRAM_REVOKED_MESSAGE,
    explainTelegramError,
    isKnownTelegramError,
    isTelegramRevoked,
    telegramErrorCode,
} from "./telegram-user-errors.policy"

describe("telegram user errors", () => {
    it("publishes the owner-facing sentences for a revoked session and a missing app", () => {
        expect(TELEGRAM_REVOKED_MESSAGE).toBe(TELEGRAM_USER_TEXT.revoked)
        expect(TELEGRAM_NOT_CONFIGURED_MESSAGE).toBe(TELEGRAM_USER_TEXT.notConfigured)
    })

    describe("telegramErrorCode", () => {
        it("reads errorMessage, then message, and answers nothing otherwise", () => {
            expect(telegramErrorCode({ errorMessage: "SESSION_REVOKED", message: "other" })).toBe("SESSION_REVOKED")
            expect(telegramErrorCode({ message: "PHONE_CODE_INVALID" })).toBe("PHONE_CODE_INVALID")
            expect(telegramErrorCode({ message: 12 })).toBe("")
            expect(telegramErrorCode(null)).toBe("")
            expect(telegramErrorCode("SESSION_REVOKED")).toBe("")
        })
    })

    describe("isTelegramRevoked", () => {
        it.each([
            "AUTH_KEY_UNREGISTERED",
            "SESSION_REVOKED",
            "SESSION_EXPIRED",
            "USER_DEACTIVATED",
            "USER_DEACTIVATED_BAN",
            "AUTH_KEY_INVALID",
            "AUTH_KEY_DUPLICATED",
        ])("is true for %s", (code) => {
            expect(isTelegramRevoked({ errorMessage: code })).toBe(true)
        })

        it("is false for a code the owner can fix and for a value with no code", () => {
            expect(isTelegramRevoked({ errorMessage: "PHONE_CODE_INVALID" })).toBe(false)
            expect(isTelegramRevoked(undefined)).toBe(false)
        })
    })

    describe("explainTelegramError and isKnownTelegramError", () => {
        it.each<[string, string]>([
            ["PHONE_CODE_INVALID", TELEGRAM_USER_TEXT.codeInvalid],
            ["PHONE_CODE_EMPTY_AGAIN", TELEGRAM_USER_TEXT.codeInvalid],
            ["PHONE_CODE_EXPIRED", TELEGRAM_USER_TEXT.codeExpired],
            ["PASSWORD_HASH_INVALID", TELEGRAM_USER_TEXT.passwordInvalid],
            ["PHONE_NUMBER_INVALID", TELEGRAM_USER_TEXT.phoneInvalid],
            ["PHONE_NUMBER_BANNED", TELEGRAM_USER_TEXT.phoneBanned],
            ["PHONE_NUMBER_FLOOD", TELEGRAM_USER_TEXT.flood],
            ["FLOOD_WAIT_30", TELEGRAM_USER_TEXT.flood],
            ["SEND_CODE_UNAVAILABLE", TELEGRAM_USER_TEXT.flood],
            ["SESSION_REVOKED", TELEGRAM_USER_TEXT.revoked],
        ])("explains %s", (code, sentence) => {
            expect(explainTelegramError({ errorMessage: code })).toBe(sentence)
            expect(isKnownTelegramError({ errorMessage: code })).toBe(true)
        })

        it("hides an unknown failure and a value that is not an error object", () => {
            expect(explainTelegramError({ errorMessage: "RPC_CALL_FAIL" })).toBe(TELEGRAM_USER_TEXT.unavailable)
            expect(explainTelegramError("down")).toBe(TELEGRAM_USER_TEXT.unavailable)
            expect(isKnownTelegramError({ message: "RPC_CALL_FAIL" })).toBe(false)
            expect(isKnownTelegramError(1)).toBe(false)
        })
    })
})
