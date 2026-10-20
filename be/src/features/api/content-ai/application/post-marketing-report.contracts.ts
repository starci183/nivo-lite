import type { Locale } from "@modules/platform/i18n"

/** Syncs insights and posts the weekly report card. */
export interface PostMarketingReportRequest {
    /** The workspaceId. */
    readonly workspaceId: string
    /** The locale. */
    readonly locale: Locale
}
