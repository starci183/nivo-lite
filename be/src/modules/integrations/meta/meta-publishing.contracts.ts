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
