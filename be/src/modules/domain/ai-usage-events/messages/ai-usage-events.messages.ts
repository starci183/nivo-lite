import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the usage capability, Vietnamese and English. */
export const AI_USAGE_EVENTS_MESSAGES: MessageBundle = {
    vi: {
        "usage.exceeded":
            "Workspace của bạn đã dùng hết hạn mức AI của tháng này, nên AI tạm dừng cho đến kỳ mới. Bạn có thể nạp thêm credit hoặc nâng cấp gói tại Credit & gói (/billing) để dùng tiếp.",
        "usage.notice.warn":
            "Mức dùng AI tháng này đã đạt {{percent}}% hạn mức ({{use}}). Khi hết hạn mức, chatbot sẽ chuyển câu hỏi của khách cho nhân viên thay vì tự trả lời. Nạp thêm credit hoặc nâng cấp gói tại Credit & gói (/billing).",
        "usage.notice.exceeded":
            "Workspace đã dùng hết hạn mức AI của tháng này ({{use}}). Chatbot tạm dừng tự trả lời: khách nhận lời xác nhận lịch sự và câu hỏi được chuyển cho nhân viên. Nạp thêm credit hoặc nâng cấp gói tại Credit & gói (/billing) để chatbot hoạt động lại.",
    },
    en: {
        "usage.exceeded":
            "Your workspace has used up this month's AI allowance, so AI is paused until the next period. You can top up credits or upgrade your plan in Credits & plan (/billing) to continue.",
        "usage.notice.warn":
            "This month's AI use reached {{percent}}% of the allowance ({{use}}). When it runs out, the chatbot hands customers' questions to staff instead of answering. Top up credits or upgrade the plan at Credits & plans (/billing).",
        "usage.notice.exceeded":
            "The workspace used up its AI allowance for this month ({{use}}). The chatbot stops answering by itself: customers get a polite acknowledgement and their questions go to staff. Top up credits or upgrade the plan at Credits & plans (/billing) to turn the chatbot back on.",
    },
}
