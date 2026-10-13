import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the usage capability, Vietnamese and English. */
export const AI_USAGE_EVENTS_MESSAGES: MessageBundle = {
    vi: {
        "usage.exceeded":
            "Workspace của bạn đã dùng hết hạn mức AI của tháng này, nên AI tạm dừng cho đến kỳ mới. Bạn có thể nạp thêm credit hoặc nâng cấp gói tại Credit & gói (/billing) để dùng tiếp.",
    },
    en: {
        "usage.exceeded":
            "Your workspace has used up this month's AI allowance, so AI is paused until the next period. You can top up credits or upgrade your plan in Credits & plan (/billing) to continue.",
    },
}
