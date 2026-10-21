/** A Page post to schedule: the text, the public image urls Meta fetches and the publish moment. */
export interface ScheduledPagePost {
    /** The caption, hashtags included. */
    readonly message: string
    /** Public (signed) https urls of the images, in order; empty for a text post. */
    readonly imageUrls: ReadonlyArray<string>
    /** When Meta publishes the post: between 10 minutes and 30 days ahead. */
    readonly publishAt: Date
}

/** What Meta answered for a scheduled post. */
export interface ScheduledPagePostResult {
    /** The id of the unpublished, scheduled post (`<page>_<post>`). */
    readonly postId: string
    /** The ids of the uploaded, unpublished photos the post carries. */
    readonly photoIds: ReadonlyArray<string>
    /** The unix time Meta was asked to publish at. */
    readonly scheduledPublishTime: number
}

/** One day of the Page insights the weekly report reads. */
export interface PageInsightsDay {
    /** The day, `YYYY-MM-DD` (the `end_time` day of Meta, Page time zone). */
    readonly day: string
    /** Unique people reached. */
    readonly reach: number
    /** Post engagements (reactions, comments, shares, clicks). */
    readonly engagements: number
}

/** One published post of the Page with the engagements Meta counted for it. */
export interface PagePost {
    /** The post id (`<page>_<post>`). */
    readonly id: string
    /** The post text; empty for a photo without a caption. */
    readonly message: string
    /** When Meta published it, ISO 8601. */
    readonly createdTime: string
    /** The public https link of the post, or null when Meta gave none. */
    readonly permalink: string | null
    /** The `post_engagements` lifetime insight (reactions, comments, shares, clicks); 0 when Meta gave none. */
    readonly engagements: number
}
