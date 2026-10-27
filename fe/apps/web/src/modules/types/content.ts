import type { BadgeTone } from "@starci/grammar/common"

/** A social channel a post can be written for. */
export type ContentChannel = "facebook" | "zalo" | "tiktok" | "instagram"

/** A content theme of a workspace. */
export interface Pillar {
    readonly id: string
    readonly workspace_id: string
    readonly name: string
    readonly description: string
    readonly weight: number
    readonly sort: number
    readonly active: boolean
}

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

/** The translator of the content catalog, as the drawings receive it. */
export type ContentT = (key: string, values?: Record<string, string | number>) => string

/** A post ready to draw: every word and format is already resolved. */
export interface PostView {
    readonly id: string
    readonly title: string
    readonly time: string
    readonly when: string
    readonly brief: string | null
    readonly statusLabel: string
    readonly tone: BadgeTone
    readonly isSkipped: boolean
    /** Whether the post can still change date. */
    readonly canMove: boolean
    readonly channels: ReadonlyArray<string>
    readonly pillar: string | null
}

/** A picture or video of a post ready to draw. */
export interface MediaTile {
    readonly key: string
    readonly name: string
    readonly kind: "image" | "video" | "text"
    readonly url: string | null
    readonly isSuggested: boolean
}

/** A file the member can download to post by hand. */
export interface DownloadFile {
    readonly key: string
    readonly name: string
    readonly url: string
}

/** The "post it by hand" step of one channel of an approved post. */
export interface PublishStep {
    readonly channel: ContentChannel
    readonly label: string
    readonly text: string
    /** Who posted it when, and the proof, or null while it is not marked. */
    readonly doneText: string | null
    readonly isZalo: boolean
}

/** One line of the history of a post. */
export interface HistoryRow {
    readonly id: string
    readonly text: string
    readonly at: string
    readonly timeLabel: string
}

/** The text of one channel of a waiting post. */
export interface QuoteView {
    readonly channel: string
    readonly label: string
    readonly text: string
}
