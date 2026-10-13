import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the knowledge codes and of the owner notices about the AI allowance, Vietnamese and English. */
export const KNOWLEDGE_MESSAGES: MessageBundle = {
    vi: {
        "errors.KNOWLEDGE_MODULE_UNKNOWN": "Không tìm thấy agent này.",
        "errors.KNOWLEDGE_EMBEDDING_UNAVAILABLE": "Chưa kết nối được dịch vụ nhúng văn bản. Sẽ thử lại sau.",
        "usage.notice.warn":
            "Mức dùng AI tháng này đã đạt {{percent}}% hạn mức ({{use}}). Khi hết hạn mức, chatbot sẽ chuyển câu hỏi của khách cho nhân viên thay vì tự trả lời. Nạp thêm credit hoặc nâng cấp gói tại Credit & gói (/billing).",
        "usage.notice.exceeded":
            "Workspace đã dùng hết hạn mức AI của tháng này ({{use}}). Chatbot tạm dừng tự trả lời: khách nhận lời xác nhận lịch sự và câu hỏi được chuyển cho nhân viên. Nạp thêm credit hoặc nâng cấp gói tại Credit & gói (/billing) để chatbot hoạt động lại.",
    },
    en: {
        "errors.KNOWLEDGE_MODULE_UNKNOWN": "This agent was not found.",
        "errors.KNOWLEDGE_EMBEDDING_UNAVAILABLE":
            "The text embedding service could not be reached. It will be tried again.",
        "usage.notice.warn":
            "This month's AI use reached {{percent}}% of the allowance ({{use}}). When it runs out, the chatbot hands customers' questions to staff instead of answering. Top up credits or upgrade the plan at Credits & plans (/billing).",
        "usage.notice.exceeded":
            "The workspace used up its AI allowance for this month ({{use}}). The chatbot stops answering by itself: customers get a polite acknowledgement and their questions go to staff. Top up credits or upgrade the plan at Credits & plans (/billing) to turn the chatbot back on.",
    },
}
