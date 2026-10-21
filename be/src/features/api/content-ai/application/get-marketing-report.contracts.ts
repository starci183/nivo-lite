import type { Locale } from "@modules/platform/i18n"

/** Reads the weekly marketing report. */
export interface GetMarketingReportRequest {
    /** The workspace whose report is read. */
    readonly workspaceId: string
    /** The Monday of the week, `YYYY-MM-DD`; empty for the last complete week. */
    readonly weekStart: string
    /** The language the suggestion is written in. */
    readonly locale: Locale
}
