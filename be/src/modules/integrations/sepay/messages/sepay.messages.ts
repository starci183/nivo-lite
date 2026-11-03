import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the SePay codes, Vietnamese and English. */
export const SEPAY_MESSAGES: MessageBundle = {
    vi: {
        "errors.SEPAY_UNAVAILABLE": "SePay hiện không phản hồi.",
        "errors.SEPAY_REJECTED": "SePay từ chối yêu cầu: {{reason}}.",
        "errors.SEPAY_AUTH_FAILED": "SePay không chấp nhận API token của kết nối.",
        "errors.SEPAY_RATE_LIMITED": "SePay yêu cầu chậm lại, thử lại sau.",
    },
    en: {
        "errors.SEPAY_UNAVAILABLE": "SePay is not answering.",
        "errors.SEPAY_REJECTED": "SePay refused the request: {{reason}}.",
        "errors.SEPAY_AUTH_FAILED": "SePay did not accept the API token of the connection.",
        "errors.SEPAY_RATE_LIMITED": "SePay asked to slow down; try again later.",
    },
}
