import type { ScriptBeat, MarketingWeeklyReport } from "./content-agent.contracts"

/** One composed image of a draft. */
export interface DraftImage {
    /** The object path in the `media` bucket (`<workspace>/marketing/<item>/1.png`). */
    readonly path: string
    /** Width in pixels. */
    readonly width: number
    /** Height in pixels. */
    readonly height: number
}

/** One knowledge source a card used: the data layer (1 connectors, 2 Second Brain, 3 learned, 4 NIVO base) and what. */
export interface CardSource {
    /** The data layer, 1..4. */
    readonly layer: number
    /** What was used (`brand_kit:<file>`, `media_library`, `owner_request`). */
    readonly label: string
}

/** The post draft AI Marketing wrote for an "@AI Marketing ..." request. */
export interface DraftPostCard {
    /** Discriminator. */
    readonly kind: "draft_post"
    /** The draft_post work item the request became. */
    readonly workItemId: string | null
    /** The content item holding the draft. */
    readonly contentItemId: string
    /** The title. */
    readonly title: string
    /** The caption without hashtags. */
    readonly caption: string
    /** The hashtags. */
    readonly hashtags: ReadonlyArray<string>
    /** The two brand images. */
    readonly images: ReadonlyArray<DraftImage>
    /** The 15 second video script. */
    readonly script: ReadonlyArray<ScriptBeat>
    /** The channels it is meant for. */
    readonly channels: ReadonlyArray<string>
    /** The sources the draft used. */
    readonly sources: ReadonlyArray<CardSource>
}

/** The publish_post decision waiting for the owner. */
export interface ApprovalRequestCard {
    /** Discriminator. */
    readonly kind: "approval_request"
    /** The publish_post work item a person decides (approve / reject through the decisions API). */
    readonly workItemId: string | null
    /** The content item. */
    readonly contentItemId: string
    /** The title. */
    readonly title: string
    /** The channels it will be scheduled on. */
    readonly channels: ReadonlyArray<string>
    /** When it will be published, ISO 8601. */
    readonly scheduledAt: string
}

/** Where one channel scheduled the post. */
export interface ScheduledChannel {
    /** The channel. */
    readonly channel: string
    /** The provider reference (Meta post id, Zalo article token). */
    readonly ref: string
}

/** One channel that refused to schedule the post. */
export interface FailedChannel {
    /** The channel. */
    readonly channel: string
    /** Why, as a short code (`meta_not_connected`, `zalo_cover_missing`...) or the provider's text. */
    readonly reason: string
}

/** The approved post was scheduled on the networks. */
export interface ScheduleConfirmedCard {
    /** Discriminator. */
    readonly kind: "schedule_confirmed"
    /** The publish_post work item that was approved. */
    readonly workItemId: string | null
    /** The content item. */
    readonly contentItemId: string
    /** The title. */
    readonly title: string
    /** When the networks publish it, ISO 8601. */
    readonly scheduledAt: string
    /** The channels that accepted it. */
    readonly channels: ReadonlyArray<ScheduledChannel>
    /** The channels that refused it, with the reason. */
    readonly failed: ReadonlyArray<FailedChannel>
}

/** The weekly marketing report. */
export interface WeeklyReportCard {
    /** Discriminator. */
    readonly kind: "weekly_report"
    /** No work item. */
    readonly workItemId: null
    /** The report. */
    readonly report: MarketingWeeklyReport
}

/** One card AI Marketing posts into the Marketing room. */
export type MarketingCard = DraftPostCard | ApprovalRequestCard | ScheduleConfirmedCard | WeeklyReportCard
