import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the Tino codes, Vietnamese and English. */
export const TINO_MESSAGES: MessageBundle = {
    vi: {
        "errors.TINO_UNREACHABLE": "Tino hiện không phản hồi.",
        "errors.TINO_FAILED": "Tino trả lỗi hệ thống; chưa biết thao tác đã thực hiện hay chưa.",
        "errors.TINO_AUTH_FAILED": "Tino không chấp nhận token API của kết nối.",
        "errors.TINO_REJECTED": "Tino từ chối yêu cầu: {{reason}}.",
    },
    en: {
        "errors.TINO_UNREACHABLE": "Tino is not answering.",
        "errors.TINO_FAILED": "Tino answered a server failure; whether the operation ran is not known.",
        "errors.TINO_AUTH_FAILED": "Tino did not accept the API token of the connection.",
        "errors.TINO_REJECTED": "Tino refused the request: {{reason}}.",
    },
}
