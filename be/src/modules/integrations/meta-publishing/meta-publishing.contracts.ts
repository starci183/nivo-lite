/**
 * The Graph API limits the documentation states for the publishing edges. Carousel: "up to 20" children (`children`, comma-separated
 * container ids; https://developers.facebook.com/docs/instagram-platform/content-publishing). The Page feed post needs `message` or
 * `link` ("You must provide `link` or `message`", https://developers.facebook.com/docs/graph-api/reference/page/feed/). A Page photo needs
 * `url` ("You must specify this or a file attachment", https://developers.facebook.com/docs/graph-api/reference/page/photos/). The
 * documentation states no maximum length for a message, a caption or a description, so none is invented here.
 */
export const INSTAGRAM_CAROUSEL_MAX = 20

/** The credential of one Page (and its linked Instagram account) a call is made with. */
export interface MetaPublishingAccess {
    /** The Page access token (Facebook Page posts need a Page token of a person who can `CREATE_CONTENT`; sent as `access_token`). */
    readonly token: string
    /** The Facebook Page id. */
    readonly pageId: string
    /** The linked Instagram professional account id, or null. */
    readonly igId: string | null
}

/** What a Page feed post sends. */
export interface FeedPostRequest {
    /** `message`, or null. */
    readonly message: string | null
    /** `link`, or null. */
    readonly link: string | null
}

/** A Page feed post as Graph answered it. */
export interface FeedPostAnswer {
    /** `id` of the post. */
    readonly id: string
}

/** What a Page photo sends. */
export interface PhotoPostRequest {
    /** `url`: the address of a photo on the internet. */
    readonly url: string
    /** `caption`, or null. */
    readonly caption: string | null
}

/** A Page photo as Graph answered it. */
export interface PhotoPostAnswer {
    /** `id` of the photo. */
    readonly id: string
    /** `post_id` of the post it made, or null when Graph answered none. */
    readonly postId: string | null
}

/** What a Page video sends. */
export interface VideoPostRequest {
    /** `file_url`: an accessible address of the video file. */
    readonly fileUrl: string
    /** `description`, or null. */
    readonly description: string | null
    /** `title`, or null. */
    readonly title: string | null
}

/** A Page video as Graph answered it. */
export interface VideoPostAnswer {
    /** `id` of the video. */
    readonly id: string
}

/** The fields one Instagram media container is created with (the documented parameter names; a field absent here is not sent). */
export interface ContainerRequest {
    /** `media_type`: `VIDEO`, `REELS`, `STORIES` or `CAROUSEL`; null for an image. */
    readonly mediaType: "VIDEO" | "REELS" | "CAROUSEL" | null
    /** `image_url`, or null. */
    readonly imageUrl: string | null
    /** `video_url`, or null. */
    readonly videoUrl: string | null
    /** `caption`, or null. */
    readonly caption: string | null
    /** `alt_text`, or null. */
    readonly altText: string | null
    /** `is_carousel_item`: true for a child of a carousel, else null. */
    readonly isCarouselItem: boolean | null
    /** `children`: the container ids of a carousel, empty otherwise. */
    readonly children: ReadonlyArray<string>
    /** `is_ai_generated`, or null. */
    readonly aiGenerated: boolean | null
}

/** Where Instagram says a container stands: its `status_code` word. */
export const CONTAINER_STATUS_CODES = ["EXPIRED", "ERROR", "FINISHED", "IN_PROGRESS", "PUBLISHED"] as const

/** One `status_code` Instagram documents. */
export type ContainerStatusCode = (typeof CONTAINER_STATUS_CODES)[number]
