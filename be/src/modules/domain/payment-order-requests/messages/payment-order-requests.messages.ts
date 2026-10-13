import type { MessageBundle } from "@modules/platform/i18n"

/** Localized payment-order-request failures. */
export const PAYMENT_ORDER_REQUESTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.PAYMENT_ORDER_REQUESTS_INVALID": "Yêu cầu thanh toán không hợp lệ.",
        "errors.PAYMENT_ORDER_REQUESTS_NOT_CREATED": "Không tạo được yêu cầu thanh toán, hãy thử lại.",
        "errors.PAYMENT_ORDER_REQUESTS_JOB_FAILED": "Không xử lý được yêu cầu thanh toán, hãy thử lại.",
    },
    en: {
        "errors.PAYMENT_ORDER_REQUESTS_INVALID": "The payment request is invalid.",
        "errors.PAYMENT_ORDER_REQUESTS_NOT_CREATED": "The payment request could not be created, please try again.",
        "errors.PAYMENT_ORDER_REQUESTS_JOB_FAILED": "The payment request could not be processed, please try again.",
    },
}
