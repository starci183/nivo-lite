import type { QuotaStatus } from "./ai-usage-events.contracts"

const format = (value: number): string => new Intl.NumberFormat("vi-VN").format(value)

/** The use of this month in one line (the `use` of the notice words): credits, top-up credits left, messages and tokens, each only when it applies. */
export const noticeUseOf = (status: QuotaStatus): string =>
    [
        status.creditsLimit === null
            ? null
            : `${format(Math.round(status.creditsUsed))}/${format(status.creditsLimit)} credit`,
        status.topupBalance > 0 ? `${format(status.topupBalance)} credit n\u1ea1p th\u00eam c\u00f2n l\u1ea1i` : null,
        status.messagesLimit === null
            ? null
            : `${format(status.messagesUsed)}/${format(status.messagesLimit)} tin nh\u1eafn`,
        status.tokensLimit === null ? null : `${format(status.tokensUsed)}/${format(status.tokensLimit)} token`,
    ]
        .filter((part): part is string => part !== null)
        .join(", ")

/** The level a usage notice is announced at. */
type NoticeLevel = "warn" | "exceeded"

/** The key of the one notice of a month and level: a repeat of it in the same month is the same line. */
export const usageNoticeKeyOf = (periodStart: string, level: NoticeLevel): string =>
    `usage-notice:${level}:${periodStart}`

/** The level a status asks to be announced at, or null when it is fine. */
export const noticeLevelOf = (status: QuotaStatus): NoticeLevel | null =>
    status.level === "ok" ? null : status.level
