/**
 * The bounds the YouTube documentation states for a video's details (https://developers.google.com/youtube/v3/docs/videos): the title is
 * "maximum 100 characters" with no `<` or `>`; the description "maximum 5000 bytes" with no `<` or `>`; the tags "maximum total length
 * 500 characters", commas between items counting and a tag with a space counted as if wrapped in quotation marks.
 */
export const YOUTUBE_TITLE_MAX = 100
export const YOUTUBE_DESCRIPTION_MAX_BYTES = 5000
export const YOUTUBE_TAGS_MAX_CHARS = 500

/** The privacy values the documentation lists for `status.privacyStatus`. */
export const YOUTUBE_PRIVACY_STATUSES = ["private", "public", "unlisted"] as const

/** The writable members of one upload NIVO sends (the documented names). */
export interface YoutubeUploadMetadata {
    /** `snippet.title`. */
    readonly title: string
    /** `snippet.description`. */
    readonly description: string
    /** `snippet.tags`. */
    readonly tags: ReadonlyArray<string>
    /** `snippet.categoryId`, or null. */
    readonly categoryId: string | null
    /** `status.privacyStatus`, or null. */
    readonly privacyStatus: string | null
    /** `status.publishAt`, or null. */
    readonly publishAt: string | null
    /** `status.selfDeclaredMadeForKids`, or null. */
    readonly madeForKids: boolean | null
    /** The `notifySubscribers` query parameter, or null for YouTube's default. */
    readonly notifySubscribers: boolean | null
}

/** A video as `videos.list` (parts `status` and `processingDetails`) answers it. */
export interface YoutubeVideoStatus {
    /** `id`. */
    readonly videoId: string
    /** `status.uploadStatus` (`deleted`, `failed`, `processed`, `rejected`, `uploaded`), or null when absent. */
    readonly uploadStatus: string | null
    /** `status.failureReason` or `status.rejectionReason`, or null. */
    readonly reason: string | null
    /** `status.privacyStatus`, or null. */
    readonly privacyStatus: string | null
    /** `processingDetails.processingStatus` (`failed`, `processing`, `succeeded`, `terminated`), or null. */
    readonly processingStatus: string | null
}
