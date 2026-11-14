import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the payOS codes, Vietnamese and English. */
export const PAYOS_MESSAGES: MessageBundle = {
    vi: {
        "errors.PAYOS_UNREACHABLE": "payOS hiện không phản hồi.",
        "errors.PAYOS_FAILED": "payOS trả lỗi hệ thống; chưa biết thao tác đã thực hiện hay chưa.",
        "errors.PAYOS_AUTH_FAILED": "payOS không chấp nhận khoá của kết nối: {{reason}}.",
        "errors.PAYOS_RATE_LIMITED": "payOS yêu cầu chậm lại, thử lại sau.",
        "errors.PAYOS_NOT_FOUND": "payOS không có link thanh toán này.",
        "errors.PAYOS_REJECTED": "payOS từ chối yêu cầu: {{reason}}.",
    },
    en: {
        "errors.PAYOS_UNREACHABLE": "payOS is not answering.",
        "errors.PAYOS_FAILED": "payOS answered a server failure; whether the operation ran is not known.",
        "errors.PAYOS_AUTH_FAILED": "payOS did not accept the connection's keys: {{reason}}.",
        "errors.PAYOS_RATE_LIMITED": "payOS asked to slow down; try again later.",
        "errors.PAYOS_NOT_FOUND": "payOS has no such payment link.",
        "errors.PAYOS_REJECTED": "payOS refused the request: {{reason}}.",
    },
}
