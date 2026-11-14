import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the iNET codes, Vietnamese and English. */
export const INET_MESSAGES: MessageBundle = {
    vi: {
        "errors.INET_UNREACHABLE": "iNET hiện không phản hồi.",
        "errors.INET_FAILED": "iNET trả lỗi hệ thống; chưa biết thao tác đã thực hiện hay chưa.",
        "errors.INET_AUTH_FAILED": "iNET không chấp nhận khoá API của kết nối.",
        "errors.INET_RATE_LIMITED": "iNET yêu cầu chậm lại, thử lại sau.",
        "errors.INET_NOT_SERVED": "iNET không có thao tác này.",
        "errors.INET_REJECTED": "iNET từ chối yêu cầu: {{reason}}.",
        "errors.INET_CONFLICT": "iNET báo dữ liệu đã tồn tại.",
    },
    en: {
        "errors.INET_UNREACHABLE": "iNET is not answering.",
        "errors.INET_FAILED": "iNET answered a server failure; whether the operation ran is not known.",
        "errors.INET_AUTH_FAILED": "iNET did not accept the API key of the connection.",
        "errors.INET_RATE_LIMITED": "iNET asked to slow down; try again later.",
        "errors.INET_NOT_SERVED": "iNET has no such operation.",
        "errors.INET_REJECTED": "iNET refused the request: {{reason}}.",
        "errors.INET_CONFLICT": "iNET says the resource already exists.",
    },
}
