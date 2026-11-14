import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { ProviderOperation } from "@modules/integrations/provider-http"

/** The provider segment of the YouTube level-1 names; YouTube is served by the `google` account, so the segment is Google's. */
const SEGMENT = "nivo.api.google"

/** The name of each YouTube operation NIVO calls. */
type YoutubeOperationName = "videosInsertStart" | "videosInsertUpload" | "playlistItemsInsert" | "videosList" | "thumbnailsSet"

/**
 * Every YouTube Data API v3 operation NIVO calls (auth: `Authorization: Bearer` with the scope `https://www.googleapis.com/auth/youtube`,
 * which the reference pages of videos.insert, thumbnails.set and playlistItems.insert all list). `serves` carries the DOMAIN tool ids as
 * `TOOL` constants.
 */
export const YOUTUBE_OPERATIONS: Readonly<Record<YoutubeOperationName, ProviderOperation>> = {
    videosInsertStart: {
        api: `${SEGMENT}.youtube.videos.insert-start`,
        method: "POST",
        path: "/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        docs: "https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol",
        status: "built",
        serves: TOOL.youtubeVideoPublish,
    },
    videosInsertUpload: {
        api: `${SEGMENT}.youtube.videos.insert-upload`,
        method: "PUT",
        path: "{Location of the resumable session}",
        docs: "https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol",
        status: "built",
        serves: TOOL.youtubeVideoPublish,
    },
    playlistItemsInsert: {
        api: `${SEGMENT}.youtube.playlist-items.insert`,
        method: "POST",
        path: "/youtube/v3/playlistItems?part=snippet",
        docs: "https://developers.google.com/youtube/v3/docs/playlistItems/insert",
        status: "built",
        serves: TOOL.youtubeVideoPublish,
    },
    videosList: {
        api: `${SEGMENT}.youtube.videos.list`,
        method: "GET",
        path: "/youtube/v3/videos?part=status,processingDetails&id={video id}",
        docs: "https://developers.google.com/youtube/v3/docs/videos/list",
        status: "built",
        serves: TOOL.youtubeVideoStatusGet,
    },
    thumbnailsSet: {
        api: `${SEGMENT}.youtube.thumbnails.set`,
        method: "POST",
        path: "/upload/youtube/v3/thumbnails/set?videoId={video id}",
        docs:
            "docs-missing: https://developers.google.com/youtube/v3/docs/thumbnails/set documents the path, videoId, the types image/jpeg, image/png, " +
            "application/octet-stream and the size (50MB; localized pages say 2MB) but NOT the request body encoding or an upload type; " +
            "https://developers.google.com/youtube/v3/guides/uploading_a_video documents none either; only third-party pages describe a raw body.",
        status: "docs-missing",
        serves: TOOL.youtubeVideoPublish,
    },
}
