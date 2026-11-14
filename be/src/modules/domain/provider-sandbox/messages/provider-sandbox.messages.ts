import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the provider-sandbox codes, Vietnamese and English. */
export const PROVIDER_SANDBOX_MESSAGES: MessageBundle = {
    vi: {
        "errors.PROVIDER_SANDBOX_LIVE_ACCOUNT": "Tài khoản này là tài khoản thật, không phải Sandbox.",
        "errors.PROVIDER_SANDBOX_ACCOUNT_NOT_FOUND": "Không tìm thấy tài khoản Sandbox này.",
        "errors.PROVIDER_SANDBOX_WEBHOOK_KEY_REFUSED": "Khóa Sandbox của tài khoản không đúng.",
        "errors.PROVIDER_SANDBOX_CASE_UNKNOWN": "Sandbox của nhà cung cấp không có tình huống {{caseId}}.",
        "errors.PROVIDER_SANDBOX_OFF": "Sandbox đang tắt trên môi trường này.",
        "errors.PROVIDER_SANDBOX_INPUT_INVALID": "Thiếu hoặc sai giá trị {{field}} của tình huống Sandbox.",
        "errors.PROVIDER_SANDBOX_RUN_NOT_WAITING": "Run này không còn đang chờ, không thể cho hết hạn chờ.",
        "errors.PROVIDER_SANDBOX_PROVIDER_UNKNOWN": "Nhà cung cấp {{provider}} chưa có Sandbox.",
    },
    en: {
        "errors.PROVIDER_SANDBOX_LIVE_ACCOUNT": "This account is a live account, not a Sandbox one.",
        "errors.PROVIDER_SANDBOX_ACCOUNT_NOT_FOUND": "This Sandbox account was not found.",
        "errors.PROVIDER_SANDBOX_WEBHOOK_KEY_REFUSED": "The Sandbox key of the account does not match.",
        "errors.PROVIDER_SANDBOX_CASE_UNKNOWN": "The provider's Sandbox has no case {{caseId}}.",
        "errors.PROVIDER_SANDBOX_OFF": "The Sandbox is switched off in this environment.",
        "errors.PROVIDER_SANDBOX_INPUT_INVALID": "The Sandbox case's input {{field}} is missing or of the wrong kind.",
        "errors.PROVIDER_SANDBOX_RUN_NOT_WAITING": "This run is no longer waiting: its wait cannot be expired.",
        "errors.PROVIDER_SANDBOX_PROVIDER_UNKNOWN": "The provider {{provider}} has no Sandbox.",
    },
}
