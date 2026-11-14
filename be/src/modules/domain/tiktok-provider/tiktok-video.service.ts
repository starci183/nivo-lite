import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import type {
    TiktokCreator,
    TiktokPublishPort,
    TiktokPublishRequest,
    TiktokPublishStarted,
    TiktokPublishState,
    TiktokPublishStatus,
} from "@modules/domain/provider-registry"
import {
    TIKTOK_VIDEO_TYPES,
    TiktokError,
    TiktokErrorCode,
    chunkPlanOf,
    InjectTiktok,
    type TiktokClient,
    type TiktokInitRequest,
} from "@modules/integrations/tiktok"
import { TiktokCredentialService } from "./tiktok-credential.service"
import { TIKTOK_PROVIDER, tiktokFailureOf } from "./tiktok-failure.policy"
import { DomainError } from "@modules/platform/errors"

/**
 * Where a post stands by TikTok's documented status words alone
 * (https://developers.tiktok.com/doc/content-posting-api-reference-get-video-status): `PUBLISH_COMPLETE` is published, `FAILED` failed,
 * every other word (`PROCESSING_UPLOAD`, `PROCESSING_DOWNLOAD`, `SEND_TO_USER_INBOX`) still on its way.
 */
export const publishStateOf = (providerStatus: string): TiktokPublishState => {
    if (providerStatus === "PUBLISH_COMPLETE") return "published"
    return providerStatus === "FAILED" ? "failed" : "pending"
}

const mediaTypeOf = (declared: string | null): string => TIKTOK_VIDEO_TYPES.find((type) => type === declared) ?? "video/mp4"

@Injectable()
/**
 * TikTok as the adapter of the destination port (`TiktokPublishPort`): the creator's limits, a direct post (PULL_FROM_URL, or FILE_UPLOAD
 * in chunks) and its status. A token TikTok refuses (401) is refreshed once and the call repeated; the post is never repeated after
 * TikTok may have acted.
 */
export class TiktokVideoService implements TiktokPublishPort {
    /** The provider key. */
    readonly provider: string = TIKTOK_PROVIDER

    constructor(
        @InjectTiktok() private readonly client: TiktokClient,
        private readonly credentials: TiktokCredentialService,
    ) {}

    /** `POST creator_info/query`: what the creator may post with. */
    creator(connection: ConnectionRecord): Promise<TiktokCreator> {
        return this.withToken(connection, (token) => this.client.creatorInfo(token))
    }

    /** `POST video/init`, then the chunks of a file source: answers the publish id to poll. */
    publish(connection: ConnectionRecord, request: TiktokPublishRequest): Promise<TiktokPublishStarted> {
        return this.withToken(connection, async (token) => {
            if (request.source.kind === "url") {
                const started = await this.client.initPost(token, initOf(request, { kind: "pull", videoUrl: request.source.videoUrl }))
                return { publishId: started.publishId }
            }
            const file = request.source.file
            const bytes = await file.fetch()
            const plan = chunkPlanOf(bytes.length)
            const started = await this.client.initPost(token, initOf(request, { kind: "upload", plan }))
            if (started.uploadUrl === null) throw new TiktokError({ code: TiktokErrorCode.Malformed, params: { what: "upload_url" } })
            await this.client.uploadVideo(started.uploadUrl, bytes, mediaTypeOf(file.mimeType), plan)
            return { publishId: started.publishId }
        })
    }

    /** `POST status/fetch`: where the post stands. */
    status(connection: ConnectionRecord, publishId: string): Promise<TiktokPublishStatus> {
        return this.withToken(connection, async (token) => {
            const read = await this.client.status(token, publishId)
            return {
                publishId,
                state: publishStateOf(read.status),
                providerStatus: read.status,
                failReason: read.failReason,
                postIds: read.postIds,
            }
        })
    }

    /** Runs `work` with the account's token; a 401 refreshes the token once and repeats the call (a call TikTok refused did nothing). */
    private async withToken<T>(connection: ConnectionRecord, work: (token: string) => Promise<T>): Promise<T> {
        try {
            try {
                return await work(await this.credentials.tokenOf(connection, false))
            } catch (cause) {
                if (!(cause instanceof TiktokError) || cause.code !== TiktokErrorCode.AuthFailed) throw cause
                return await work(await this.credentials.tokenOf(connection, true))
            }
        } catch (cause) {
            const failure = tiktokFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }
}

const initOf = (request: TiktokPublishRequest, source: TiktokInitRequest["source"]): TiktokInitRequest => ({
    privacyLevel: request.privacyLevel,
    title: request.title,
    disableDuet: request.disableDuet,
    disableStitch: request.disableStitch,
    disableComment: request.disableComment,
    coverTimestampMs: request.coverTimestampMs,
    brandContentToggle: request.brandContentToggle,
    brandOrganicToggle: request.brandOrganicToggle,
    isAigc: request.isAigc,
    source,
})
