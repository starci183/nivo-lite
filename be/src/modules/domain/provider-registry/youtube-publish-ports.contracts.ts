import type { ConnectionRecord } from "@modules/domain/connections"

/**
 * THE YOUTUBE DESTINATION: publishing a video to a YouTube channel, a DOMAIN purpose (`nivo.tool.youtube.video.*`), served by the
 * provider account that reaches YouTube (`google`). The upload is a bounded transfer inside one call; YouTube's own processing is
 * asynchronous, so a status read follows. A failure is thrown with what it proves (`withProof`).
 */

/** A file of the generic file store named by its id (the `stored` member of a file reference): never an address the adapter would fetch. */
export interface PublishSource {
    /** The file store's id. */
    readonly fileId: string
}

/** A file's bytes as the file store hands them to a publishing adapter. */
export interface PublishFile {
    /** The bytes. */
    readonly bytes: Buffer
    /** The media type the store keeps for it, or null. */
    readonly mimeType: string | null
}

/**
 * Where a publishing adapter reads a stored file: the generic file store (G3) behind a two-line door, bound by the app. A workspace's
 * own files only: an unknown id and another workspace's id are the same answer (null).
 */
export interface PublishFileSource {
    /** The file, or null when the workspace holds none of that id or it is larger than `maxBytes`. */
    read(workspaceId: string, fileId: string, maxBytes: number): Promise<PublishFile | null>
}

/** What one YouTube publication is asked for (YouTube's own members). */
export interface YoutubeVideoRequest {
    /** The video. */
    readonly video: PublishSource
    /** `snippet.title`. */
    readonly title: string
    /** `snippet.description`. */
    readonly description: string
    /** `snippet.tags`. */
    readonly tags: ReadonlyArray<string>
    /** `snippet.categoryId`, or null for YouTube's default. */
    readonly categoryId: string | null
    /** `status.privacyStatus`, or null for YouTube's default. */
    readonly privacyStatus: "private" | "public" | "unlisted" | null
    /** `status.publishAt` (ISO 8601; private videos only), or null. */
    readonly publishAt: string | null
    /** `status.selfDeclaredMadeForKids`, or null. */
    readonly madeForKids: boolean | null
    /** `notifySubscribers`, or null for YouTube's default. */
    readonly notifySubscribers: boolean | null
    /** The thumbnail, or null. */
    readonly thumbnail: PublishSource | null
    /** The playlist the video is added to, or null. */
    readonly playlistId: string | null
}

/** Where a video stands on YouTube: `pending` (uploaded, processing), `done` (processed), `failed` (failed, rejected or deleted). */
export type YoutubeVideoState = "pending" | "done" | "failed"

/** A video as YouTube answered it. */
export interface YoutubeVideo {
    /** The video id. */
    readonly videoId: string
    /** Where it stands. */
    readonly state: YoutubeVideoState
    /** `status.uploadStatus` as YouTube words it (`uploaded`, `processed`, `failed`, `rejected`, `deleted`). */
    readonly uploadStatus: string
    /** `status.failureReason` or `status.rejectionReason` when there is one, else null. */
    readonly reason: string | null
    /** `status.privacyStatus`, or null. */
    readonly privacyStatus: string | null
    /** `processingDetails.processingStatus`, or null (an owner-only part; absent when YouTube does not answer it). */
    readonly processingStatus: string | null
    /** The playlist item id once the video was added to the playlist, or null. */
    readonly playlistItemId: string | null
    /** The refusal reason when the playlist add failed after the upload (the video exists), else null. */
    readonly playlistFailure: string | null
}

/** A provider that publishes to YouTube. */
export interface YoutubePublishPort {
    /** The provider key. */
    readonly provider: string
    /** Uploads one video (and adds it to the playlist when asked) on the account's channel; the file store is read for the workspace. */
    publish(workspaceId: string, connection: ConnectionRecord, request: YoutubeVideoRequest): Promise<YoutubeVideo>
    /** The video as it stands. */
    status(connection: ConnectionRecord, videoId: string): Promise<YoutubeVideo>
}
