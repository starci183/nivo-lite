/** The weekly report as the Performance tab draws it. */
export interface MarketingReportView {
    readonly period: string
    readonly kpis: ReadonlyArray<{
        readonly id: string
        readonly term: string
        readonly description: string
        readonly meta: string
    }>
    /** One row per day: its total engagements and the share of each channel. */
    readonly days: ReadonlyArray<{
        readonly id: string
        readonly label: string
        readonly total: number
        readonly breakdown: string
    }>
    readonly dayMax: number
    readonly channels: ReadonlyArray<{ readonly id: string; readonly term: string; readonly description: string }>
    /** What the numbers say, read from the week itself: the strongest channel and day; empty for a week without engagement. */
    readonly insight: string
    /** The most engaging posts of the week: the title, where and when, and the engagements. */
    readonly posts: ReadonlyArray<{ readonly id: string; readonly term: string; readonly description: string }>
    /** How many of the week's published posts the list shows; empty without posts. */
    readonly postsNote: string
    /** The AI Marketing suggestion for the next week and the sources it read; null when there is none. */
    readonly suggestion: {
        readonly title: string
        readonly body: string
        readonly sources: string
    } | null
}
