import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the public-api codes, Vietnamese and English. */
export const PUBLIC_API_MESSAGES: MessageBundle = {
    vi: {
        "errors.PUBLIC_API_REQUEST_INVALID": "Yêu cầu API trong hàng đợi không hợp lệ; cần kiểm tra để khôi phục.",
        "errors.PUBLIC_API_REQUEST_NOT_FOUND": "Không tìm thấy yêu cầu API trong không gian làm việc này.",
        "errors.PUBLIC_API_INBOX_INCONSISTENT":
            "Yêu cầu API đã có biên nhận hộp thư nhưng sổ cái vẫn chưa xử lý; cần kiểm tra để khôi phục.",
        "errors.PUBLIC_API_SINCE_INVALID":
            'Tham s\u1ed1 "since" ph\u1ea3i l\u00e0 th\u1eddi \u0111i\u1ec3m ISO, v\u00ed d\u1ee5 2026-10-01T00:00:00Z.',
        "errors.PUBLIC_API_CONVERSATION_NOT_FOUND":
            "Kh\u00f4ng t\u00ecm th\u1ea5y cu\u1ed9c tr\u00f2 chuy\u1ec7n v\u1edbi kh\u00e1ch n\u00e0y.",
        "errors.PUBLIC_API_TARGET_MISSING": 'C\u1ea7n "conversationId" ho\u1eb7c "leadId".',
        "errors.PUBLIC_API_CONTENT_TOO_LONG":
            "N\u1ed9i dung d\u00e0i qu\u00e1 {{max}} k\u00fd t\u1ef1. H\u00e3y t\u00e1ch th\u00e0nh nhi\u1ec1u ngu\u1ed3n.",
        "errors.PUBLIC_API_NOT_WRITTEN":
            "Ch\u01b0a th\u00eam \u0111\u01b0\u1ee3c tri th\u1ee9c. Th\u1eed l\u1ea1i sau \u00edt ph\u00fat.",
    },
    en: {
        "errors.PUBLIC_API_REQUEST_INVALID":
            "The queued API request needs recovery because its recorded shape is invalid.",
        "errors.PUBLIC_API_REQUEST_NOT_FOUND": "No API request with this identity belongs to the workspace.",
        "errors.PUBLIC_API_INBOX_INCONSISTENT":
            "The inbox already holds a receipt for this API request while the ledger still shows it unprocessed; it needs recovery.",
        "errors.PUBLIC_API_SINCE_INVALID":
            'The "since" parameter must be an ISO time, for example 2026-10-01T00:00:00Z.',
        "errors.PUBLIC_API_CONVERSATION_NOT_FOUND": "No conversation with this customer was found.",
        "errors.PUBLIC_API_TARGET_MISSING": 'Send "conversationId" or "leadId".',
        "errors.PUBLIC_API_CONTENT_TOO_LONG":
            "The content is longer than {{max}} characters. Split it into several sources.",
        "errors.PUBLIC_API_NOT_WRITTEN": "The knowledge could not be added. Try again in a few minutes.",
    },
}
