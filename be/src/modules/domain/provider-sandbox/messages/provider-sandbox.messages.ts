import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the provider-sandbox codes, Vietnamese and English. */
export const PROVIDER_SANDBOX_MESSAGES: MessageBundle = {
    vi: {
        "errors.PROVIDER_SANDBOX_LIVE_ACCOUNT": "Tài khoản này là tài khoản thật, không phải Sandbox.",
        "errors.PROVIDER_SANDBOX_ACCOUNT_NOT_FOUND": "Không tìm thấy tài khoản Sandbox này.",
        "errors.PROVIDER_SANDBOX_WEBHOOK_KEY_REFUSED": "Khóa Sandbox của tài khoản không đúng.",
        "errors.PROVIDER_SANDBOX_ENTRY_INVALID": "Dữ liệu mẫu hoặc kịch bản Sandbox không hợp lệ.",
    },
    en: {
        "errors.PROVIDER_SANDBOX_LIVE_ACCOUNT": "This account is a live account, not a Sandbox one.",
        "errors.PROVIDER_SANDBOX_ACCOUNT_NOT_FOUND": "This Sandbox account was not found.",
        "errors.PROVIDER_SANDBOX_WEBHOOK_KEY_REFUSED": "The Sandbox key of the account does not match.",
        "errors.PROVIDER_SANDBOX_ENTRY_INVALID": "The Sandbox fixture or script is not valid.",
    },
}
