import { Injectable } from "@nestjs/common"
import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    providerRefusal,
    withProof,
    type YoutubePublishPort,
    type YoutubeVideo,
    type YoutubeVideoRequest,
    type YoutubeVideoState,
} from "@modules/domain/provider-registry"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import {
    YOUTUBE_SANDBOX_DEFAULT_JOB,
    YOUTUBE_SANDBOX_JOBS,
    YOUTUBE_SANDBOX_MISSING_PLAYLIST,
    YOUTUBE_SANDBOX_REFUSED_TITLES,
    YOUTUBE_SANDBOX_THUMBNAIL_REFUSAL,
    type YoutubeSandboxJob,
    type YoutubeSandboxRefusal,
} from "./youtube-sandbox.catalogue"

/** The sandbox operation words, the port's own method names. */
const PUBLISH_OPERATION = "publish"
const STATUS_OPERATION = "status"

/** State name: the videos the account uploaded, by video id. */
const VIDEO = "video"

/** A video as the account's state keeps it: its job, the privacy it was given and how many status reads walked the job. */
interface KeptVideo {
    readonly job: YoutubeSandboxJob
    readonly privacyStatus: string
    readonly polls: number
}

/** Where a video stands by its documented `uploadStatus` alone (the live adapter's own table). */
const STATE_OF_UPLOAD: Readonly<Record<string, YoutubeVideoState>> = {
    uploaded: "pending",
    processed: "done",
    failed: "failed",
    rejected: "failed",
    deleted: "failed",
}

const refusalOf = (refusal: YoutubeSandboxRefusal): Error => withProof(providerRefusal(PROVIDER.google, refusal.reason, refusal.detail), "not_sent")

@Injectable()
/**
 * YouTube's (through the `google` account) SANDBOX implementation of the YouTube destination (`YoutubePublishPort`; owner rulings R56,
 * R59, R60): used when the Google account is a sandbox account. It answers through the generic sandbox frame from the hardcoded
 * `YOUTUBE-<n>` catalogue and never reaches a host (the file store is not read: the sandbox holds no bytes). `publish` is picked by the
 * exact title and, like the live twin, refuses a thumbnail `not_available` first; a named title is refused as the live twin refuses it
 * (`providerRefusal` proving `not_sent`); any other title is accepted, answered `uploaded` with the privacy it was given (`private` when
 * none), and kept in state. A playlist add answers a playlist item id, or `playlistFailure: "not_found"` for the playlist the account
 * does not hold (the video exists, as live). The later outcome arrives by the live poll: `status` walks the video's catalogue steps one per
 * read and stays on the last (processed, failed with a failure reason, or rejected with a rejection reason). Video ids run
 * `sbx-yt-video-<n>` by the uploads the account took (`state.seq`). The sandbox adds no idempotency.
 */
export class YoutubeSandboxVideoService implements YoutubePublishPort {
    /** The provider key. */
    readonly provider: string = PROVIDER.google

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** Uploads one video of a sandbox account through exactly one sandbox call keyed by the title. */
    async publish(_workspaceId: string, connection: ConnectionRecord, request: YoutubeVideoRequest): Promise<YoutubeVideo> {
        return await this.sandbox.call(connection, PUBLISH_OPERATION, request, {
            key: request.title,
            answer: async (state) => {
                if (request.thumbnail !== null) throw refusalOf(YOUTUBE_SANDBOX_THUMBNAIL_REFUSAL)
                const refused = YOUTUBE_SANDBOX_REFUSED_TITLES[request.title]
                if (refused !== undefined) throw refusalOf(refused)
                const number = String(state.seq + 1).padStart(6, "0")
                const videoId = `sbx-yt-video-${number}`
                const kept: KeptVideo = {
                    job: YOUTUBE_SANDBOX_JOBS[request.title] ?? YOUTUBE_SANDBOX_DEFAULT_JOB,
                    privacyStatus: request.privacyStatus ?? "private",
                    polls: 0,
                }
                await state.write(VIDEO, videoId, kept)
                const missing = request.playlistId === YOUTUBE_SANDBOX_MISSING_PLAYLIST
                return {
                    videoId,
                    state: "pending",
                    uploadStatus: "uploaded",
                    reason: null,
                    privacyStatus: kept.privacyStatus,
                    processingStatus: null,
                    playlistItemId: request.playlistId === null || missing ? null : `sbx-yt-item-${number}`,
                    playlistFailure: missing ? "not_found" : null,
                }
            },
        })
    }

    /** The video as it stands through exactly one sandbox call keyed by the video id; each read moves the video one step on. */
    async status(connection: ConnectionRecord, videoId: string): Promise<YoutubeVideo> {
        return await this.sandbox.call(connection, STATUS_OPERATION, { videoId }, {
            key: videoId,
            answer: async (state) => {
                const value = await state.read(VIDEO, videoId)
                if (value === null) throw withProof(providerRefusal(PROVIDER.google, "not_found", "video"), "not_sent")
                const kept = value as KeptVideo
                const step = kept.job.steps[Math.min(kept.polls, kept.job.steps.length - 1)] ?? YOUTUBE_SANDBOX_DEFAULT_JOB.steps[0]
                await state.write(VIDEO, videoId, { ...kept, polls: kept.polls + 1 })
                return {
                    videoId,
                    state: STATE_OF_UPLOAD[step?.uploadStatus ?? ""] ?? "pending",
                    uploadStatus: step?.uploadStatus ?? "",
                    reason: step?.reason ?? null,
                    privacyStatus: kept.privacyStatus,
                    processingStatus: step?.processingStatus ?? null,
                    playlistItemId: null,
                    playlistFailure: null,
                }
            },
        })
    }
}
