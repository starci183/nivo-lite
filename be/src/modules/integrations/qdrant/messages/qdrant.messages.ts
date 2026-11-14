import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the Qdrant codes, Vietnamese and English. */
export const QDRANT_MESSAGES: MessageBundle = {
    vi: {
        "errors.QDRANT_UNAVAILABLE": "Chỉ mục tìm theo nghĩa hiện không phản hồi.",
        "errors.QDRANT_REJECTED": "Chỉ mục tìm theo nghĩa từ chối yêu cầu {{call}} ({{status}}).",
        "errors.QDRANT_MISMATCH":
            "Bộ sưu tập {{collection}} của chỉ mục tìm theo nghĩa đang là {{found}}, ứng dụng cần {{expected}}.",
    },
    en: {
        "errors.QDRANT_UNAVAILABLE": "The meaning index is not answering.",
        "errors.QDRANT_REJECTED": "The meaning index refused the {{call}} request ({{status}}).",
        "errors.QDRANT_MISMATCH": "Collection {{collection}} of the meaning index is {{found}}; the app needs {{expected}}.",
    },
}
