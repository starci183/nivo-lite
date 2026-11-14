import { Injectable, Optional } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    providerRefusal,
    providerRefusalReason,
    withProof,
    type ProviderRegistryError,
    type PublishFile,
    type PublishFileSource,
    type YoutubePublishPort,
    type YoutubeVideo,
    type YoutubeVideoRequest,
    type YoutubeVideoState,
} from "@modules/domain/provider-registry"
import { InjectYoutube, YoutubeError, type YoutubeClient, type YoutubeVideoStatus } from "@modules/integrations/youtube"
import { YoutubeCredentialService } from "./youtube-credential.service"
import { YOUTUBE_PROVIDER, youtubeFailureOf } from "./youtube-failure.policy"
import { InjectPublishFileSource } from "./youtube-provider.decorators"
import { DomainError } from "@modules/platform/errors"

/** The media type the documentation accepts when a file declares none (`video/*` and `application/octet-stream`). */
const OCTET_STREAM = "application/octet-stream"

/** The `status.uploadStatus` values the Video resource documents (https://developers.google.com/youtube/v3/docs/videos) and where each leaves the video. */
const STATE_OF_UPLOAD: Readonly<Record<string, YoutubeVideoState>> = {
    uploaded: "pending",
    processed: "done",
    failed: "failed",
    rejected: "failed",
    deleted: "failed",
}

/** Where a video stands, by its documented `uploadStatus` alone (an absent or unknown word is still pending). */
export const videoStateOf = (status: YoutubeVideoStatus): YoutubeVideoState => STATE_OF_UPLOAD[status.uploadStatus ?? ""] ?? "pending"

const refused = (reason: "rejected" | "not_found" | "not_available", detail: string): ProviderRegistryError =>
    withProof(providerRefusal(YOUTUBE_PROVIDER, reason, detail), "not_sent")

@Injectable()
/**
 * YouTube (through the `google` account) as the adapter of the YouTube destination (`YoutubePublishPort`): one resumable upload (session
 * start, then the file in one put), then the playlist add when asked; YouTube processes the video afterwards, so `status` reads it again.
 * The bytes come from the generic file store by id (never from an address the adapter would fetch). A thumbnail is refused
 * `not_available` before anything is sent: its documentation does not state the request body (`docs-missing`). A playlist add that fails
 * after the upload does not undo it: the video is answered with `playlistFailure`.
 */
export class YoutubeVideoService implements YoutubePublishPort {
    /** The provider key. */
    readonly provider: string = YOUTUBE_PROVIDER

    constructor(
        @InjectYoutube() private readonly client: YoutubeClient,
        private readonly credentials: YoutubeCredentialService,
        @Optional() @InjectPublishFileSource() private readonly files?: PublishFileSource | undefined,
    ) {}

    /** Uploads one video and adds it to the playlist when asked. */
    async publish(workspaceId: string, connection: ConnectionRecord, request: YoutubeVideoRequest): Promise<YoutubeVideo> {
        if (request.thumbnail !== null) throw refused("not_available", "thumbnails.set: docs-missing")
        if (this.files === undefined) throw refused("not_available", "file store")
        const file = await this.files.read(workspaceId, request.video.fileId, this.client.maxUploadBytes)
        if (file === null) throw refused("not_found", "video file")
        const contentType = this.contentTypeOf(file)
        try {
            return await this.credentials.withToken(connection, async (token) => {
                const session = await this.client.startUpload(
                    token,
                    {
                        title: request.title,
                        description: request.description,
                        tags: request.tags,
                        categoryId: request.categoryId,
                        privacyStatus: request.privacyStatus,
                        publishAt: request.publishAt,
                        madeForKids: request.madeForKids,
                        notifySubscribers: request.notifySubscribers,
                    },
                    file.bytes.length,
                    contentType,
                )
                const created = await this.client.upload(token, session, file.bytes, contentType)
                const playlist = request.playlistId === null ? null : await this.addToPlaylist(token, request.playlistId, created.videoId)
                return this.videoOf(created, playlist)
            })
        } catch (cause) {
            const failure = youtubeFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }

    /** The video as it stands (`videos.list`, parts `status` and `processingDetails`). */
    async status(connection: ConnectionRecord, videoId: string): Promise<YoutubeVideo> {
        try {
            const video = await this.credentials.withToken(connection, (token) => this.client.video(token, videoId))
            return this.videoOf(video, null)
        } catch (cause) {
            const failure = youtubeFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }

    private contentTypeOf(file: PublishFile): string {
        if (file.mimeType === null || file.mimeType === "") return OCTET_STREAM
        if (!file.mimeType.startsWith("video/") && file.mimeType !== OCTET_STREAM) throw refused("rejected", "video media type")
        return file.mimeType
    }

    /** Adds the uploaded video to the playlist; a refusal after the upload is answered, not thrown (the video exists). */
    private async addToPlaylist(token: string, playlistId: string, videoId: string): Promise<{ readonly itemId: string | null; readonly failure: string | null }> {
        try {
            return { itemId: await this.client.addToPlaylist(token, playlistId, videoId), failure: null }
        } catch (cause) {
            const typed = youtubeFailureOf(cause)
            const reason = providerRefusalReason(typed)
            if (reason !== null) return { itemId: null, failure: reason }
            if (cause instanceof YoutubeError) return { itemId: null, failure: "unavailable" }
            throw cause
        }
    }

    private videoOf(video: YoutubeVideoStatus, playlist: { readonly itemId: string | null; readonly failure: string | null } | null): YoutubeVideo {
        return {
            videoId: video.videoId,
            state: videoStateOf(video),
            uploadStatus: video.uploadStatus ?? "",
            reason: video.reason,
            privacyStatus: video.privacyStatus,
            processingStatus: video.processingStatus,
            playlistItemId: playlist?.itemId ?? null,
            playlistFailure: playlist?.failure ?? null,
        }
    }
}
