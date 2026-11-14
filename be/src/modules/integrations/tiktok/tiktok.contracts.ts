/**
 * The values and shapes of the TikTok Content Posting API as its documentation states them.
 * Direct post (https://developers.tiktok.com/doc/content-posting-api-reference-direct-post): `privacy_level` one of the four words below;
 * `title` at most 2200 UTF-16 runes; `video_cover_timestamp_ms` int32; `source` `PULL_FROM_URL` or `FILE_UPLOAD`.
 */
export const TIKTOK_PRIVACY_LEVELS = ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"] as const

/** The longest caption: "Maximum 2200 UTF-16 runes" (direct post reference). */
export const TIKTOK_TITLE_MAX = 2_200

/** The most a `publish_id` holds: "Maximum 64 characters" (direct post reference). */
export const TIKTOK_PUBLISH_ID_MAX = 64

/** The largest int32 (`video_cover_timestamp_ms` is an int32). */
export const TIKTOK_INT32_MAX = 2_147_483_647

/** The media types a chunk upload names (https://developers.tiktok.com/doc/content-posting-api-reference-direct-post, "Upload the Video"). */
export const TIKTOK_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const

/** Media transfer guide (https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide): "Maximum file size: 4 GB". */
export const TIKTOK_VIDEO_BYTES_MAX: number = 4 * 1024 ** 3

/** Media transfer guide: each chunk 5 MB to 64 MB; a file under 5 MB is one chunk; a file over 64 MB must be chunked. */
export const TIKTOK_CHUNK_MIN: number = 5 * 1024 ** 2
export const TIKTOK_CHUNK_MAX: number = 64 * 1024 ** 2

/** The creator's posting limits (creator info query). */
export interface TiktokCreatorInfo {
    /** `creator_username`. */
    readonly username: string
    /** `creator_nickname`. */
    readonly nickname: string
    /** `privacy_level_options`: the only privacy levels this creator may post with. */
    readonly privacyLevelOptions: ReadonlyArray<string>
    /** `comment_disabled`. */
    readonly commentDisabled: boolean
    /** `duet_disabled`. */
    readonly duetDisabled: boolean
    /** `stitch_disabled`. */
    readonly stitchDisabled: boolean
    /** `max_video_post_duration_sec`, or null when the answer named none. */
    readonly maxVideoPostDurationSec: number | null
}

/** The chunks of a file upload: `video_size`, `chunk_size`, `total_chunk_count` of `source_info`. */
export interface TiktokChunkPlan {
    /** `video_size`: the whole file's size in bytes. */
    readonly videoSize: number
    /** `chunk_size`: the size in bytes of every chunk but the last. */
    readonly chunkSize: number
    /** `total_chunk_count`: how many chunks the file is sent in. */
    readonly totalChunkCount: number
}

/** What a direct post init sends: `post_info` and `source_info`. */
export interface TiktokInitRequest {
    /** `post_info.privacy_level`. */
    readonly privacyLevel: string
    /** `post_info.title`, or null. */
    readonly title: string | null
    /** `post_info.disable_duet`, or null. */
    readonly disableDuet: boolean | null
    /** `post_info.disable_stitch`, or null. */
    readonly disableStitch: boolean | null
    /** `post_info.disable_comment`, or null. */
    readonly disableComment: boolean | null
    /** `post_info.video_cover_timestamp_ms`, or null. */
    readonly coverTimestampMs: number | null
    /** `post_info.brand_content_toggle`, or null. */
    readonly brandContentToggle: boolean | null
    /** `post_info.brand_organic_toggle`, or null. */
    readonly brandOrganicToggle: boolean | null
    /** `post_info.is_aigc`, or null. */
    readonly isAigc: boolean | null
    /** `source_info`: `PULL_FROM_URL` with the video's address, or `FILE_UPLOAD` with its chunks. */
    readonly source: { readonly kind: "pull"; readonly videoUrl: string } | { readonly kind: "upload"; readonly plan: TiktokChunkPlan }
}

/** The answer of a direct post init. */
export interface TiktokInitResult {
    /** `data.publish_id`. */
    readonly publishId: string
    /** `data.upload_url` (FILE_UPLOAD only), or null. */
    readonly uploadUrl: string | null
}

/** The status of one post (`status/fetch`). */
export interface TiktokPublishStatus {
    /** `data.status`. */
    readonly status: string
    /** `data.fail_reason`, or null. */
    readonly failReason: string | null
    /** `data.publicaly_available_post_id` (the documentation's spelling), as text: int64 values never pass through a double. */
    readonly postIds: ReadonlyArray<string>
    /** `data.uploaded_bytes`, or null. */
    readonly uploadedBytes: number | null
    /** `data.downloaded_bytes`, or null. */
    readonly downloadedBytes: number | null
}

/** A refreshed user token (`/v2/oauth/token/`, `grant_type=refresh_token`). */
export interface TiktokTokens {
    /** `access_token`. */
    readonly accessToken: string
    /** `refresh_token`: replaces the one sent (a replaced token cannot be used again). */
    readonly refreshToken: string
    /** `expires_in`, seconds. */
    readonly expiresInSeconds: number
}
