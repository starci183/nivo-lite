/** One post published in a week with the engagements its channel counted. */
export interface WeeklyPost {
    /** The provider post id (`<page>_<post>` for Meta, the article id for Zalo). */
    readonly id: string
    /** The channel that published it. */
    readonly channel: string
    /** The first line of the post text, or the article title. */
    readonly title: string
    /** When it was published, ISO 8601. */
    readonly publishedAt: string
    /** What the channel counted: reactions, comments, shares and clicks on Facebook; views and shares on Zalo. */
    readonly engagements: number
    /** The public https link of the post, or null when the channel gave none. */
    readonly href: string | null
}

/** One source the suggestion read, in the Hub source shape (layer 1 connectors, 2 Second Brain). */
export interface WeeklySource {
    /** The data layer, 1..4. */
    readonly layer: number
    /** The record kind (`connector`, `brain_fact`). */
    readonly kind: string
    /** What was read (`meta.page_insights`, `meta.published_posts`, `zalo.articles`, `brand_kit:<name>`). */
    readonly ref: string
    /** The data the reader recognises (the brand name, the channels); the client words the connector sources by `ref`. */
    readonly label: string
}

/** The advice of a week: a headline, the reasoning and the sources it stands on. */
export interface WeeklySuggestion {
    /** The headline, at most 120 characters. */
    readonly title: string
    /** The reasoning and the next step, at most 600 characters. */
    readonly body: string
    /** The sources the model was given. */
    readonly sources: ReadonlyArray<WeeklySource>
}

/** What the weekly report keeps beyond the daily figures: its top posts and the model's suggestion. */
export interface WeeklyExtras {
    /** The most engaging posts of the week, at most four. */
    readonly posts: ReadonlyArray<WeeklyPost>
    /** How many posts the channels published in the week. */
    readonly postCount: number
    /** The suggestion, or null when there was none. */
    readonly suggestion: WeeklySuggestion | null
}

/** The stored report of one week: its extras, when they were computed and when the report card was posted. */
export interface StoredWeeklyReport extends WeeklyExtras {
    /** When the extras were computed, ISO 8601, or null before the first computation. */
    readonly computedAt: string | null
    /** When the report card was posted into the Hub, ISO 8601, or null. */
    readonly postedAt: string | null
}

/** The stored report of a week, or null when nothing was stored for it. */
export type OptionalStoredWeeklyReport = StoredWeeklyReport | null
