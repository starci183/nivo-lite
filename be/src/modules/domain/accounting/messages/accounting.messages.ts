import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the accounting error codes, Vietnamese and English. */
export const ACCOUNTING_MESSAGES: MessageBundle = {
    vi: {
        "errors.ACCOUNTING_PAYMENT_INVALID": "Đề xuất {{item}} không có khoản thanh toán để ghi nhận.",
        "errors.ACCOUNTING_PAYMENT_NOT_RECORDED": "Kết nối chưa ghi nhận được thanh toán {{credit}}.",
    },
    en: {
        "errors.ACCOUNTING_PAYMENT_INVALID": "Proposal {{item}} carries no payment to record.",
        "errors.ACCOUNTING_PAYMENT_NOT_RECORDED": "The connector did not record payment {{credit}}.",
    },
}
