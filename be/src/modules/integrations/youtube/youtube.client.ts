import { Injectable } from "@nestjs/common"
import { InjectHttpClient, type HttpClient, type HttpRequest, type HttpResponse } from "@modules/platform/http"
import { isRecord } from "@modules/platform/primitives"
import { cutDetail, retryAfterSecondsOf, statusClassOf } from "@modules/integrations/provider-http"
import { YoutubeError, YoutubeErrorCode } from "./errors/youtube.error"
import type { YoutubeUploadMetadata, YoutubeVideoStatus } from "./youtube.contracts"
import { InjectYoutubeOptions } from "./youtube.decorators"
import type { YoutubeOptions } from "./youtube.options"

/** A YouTube id as a query value takes it (video, playlist): letters, digits, `-` and `_`. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{1,128}$/u

/**
 * The error reasons the error page documents (https://developers.google.com/youtube/v3/docs/errors, and the per-method tables): the
 * quota and rate ones are rate limits, the account ones are the credential, and the content ones are refusals of the request.
 */
const RATE_REASONS: ReadonlySet<string> = new Set(["quotaExceeded", "rateLimitExceeded", "uploadRateLimitExceeded"])
const AUTH_REASONS: ReadonlySet<string> = new Set(["insufficientPermissions", "youtubeSignupRequired", "authorizationRequired"])
const REFUSED_REASONS: ReadonlySet<string> = new Set([
    "forbiddenPrivacySetting",
    "forbiddenLicenseSetting",
    "playlistContainsMaximumNumberOfVideos",
    "playlistItemsNotAccessible",
    "uploadLimitExceeded",
])

const textOf = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null)

/** The first reason and the words of Google's error body. */
export interface YoutubeErrorBody {
    /** The first error's `reason`; "" when the body names none. */
    readonly reason: string
    /** Google's own words; "" when the body has none. */
    readonly message: string
}

/** Google's error body (`{ error: { code, message, errors: [{ reason, domain }] } }`): the first reason and the words. */
export const youtubeErrorOf = (body: unknown): YoutubeErrorBody => {
    const error = isRecord(body) && isRecord(body.error) ? body.error : null
    const first = Array.isArray(error?.errors) ? error.errors.find(isRecord) : undefined
    return { reason: textOf(first?.reason) ?? "", message: cutDetail(error?.message) ?? "" }
}

/** The typed failure of an answered status that is no success: by the documented reason, then by the status' class alone. */
const answeredFailure = (answer: HttpResponse): YoutubeError => {
    const { reason, message } = youtubeErrorOf(answer.body)
    const params = { status: answer.status, reason, detail: message }
    if (RATE_REASONS.has(reason)) {
        return new YoutubeError({ code: YoutubeErrorCode.RateLimited, params: { ...params, retryAfterSeconds: retryAfterSecondsOf(answer.headers) } })
    }
    if (AUTH_REASONS.has(reason)) return new YoutubeError({ code: YoutubeErrorCode.AuthFailed, params })
    if (REFUSED_REASONS.has(reason)) return new YoutubeError({ code: YoutubeErrorCode.Rejected, params })
    switch (statusClassOf(answer.status)) {
        case "auth":
            return new YoutubeError({ code: YoutubeErrorCode.AuthFailed, params })
        case "rate_limited":
            return new YoutubeError({ code: YoutubeErrorCode.RateLimited, params: { ...params, retryAfterSeconds: retryAfterSecondsOf(answer.headers) } })
        case "not_found":
            return new YoutubeError({ code: YoutubeErrorCode.NotFound, params })
        case "rejected":
            return new YoutubeError({ code: YoutubeErrorCode.Rejected, params })
        case "ok":
        case "server":
        default:
            return new YoutubeError({ code: YoutubeErrorCode.Failed, params })
    }
}

const malformed = (what: string): never => {
    throw new YoutubeError({ code: YoutubeErrorCode.Malformed, params: { what } })
}

/** The refusal of an argument NIVO will not put on a URL or send: nothing was sent. */
const refusedArgument = (what: string): never => {
    throw new YoutubeError({ code: YoutubeErrorCode.Rejected, params: { status: 0, reason: "", detail: what } })
}

/** The members of an upload NIVO sends: the video resource of the resumable start (`snippet`, `status`). */
export const uploadBodyOf = (metadata: YoutubeUploadMetadata): unknown => ({
    snippet: {
        title: metadata.title,
        description: metadata.description,
        ...(metadata.tags.length === 0 ? {} : { tags: [...metadata.tags] }),
        ...(metadata.categoryId === null ? {} : { categoryId: metadata.categoryId }),
    },
    status: {
        ...(metadata.privacyStatus === null ? {} : { privacyStatus: metadata.privacyStatus }),
        ...(metadata.publishAt === null ? {} : { publishAt: metadata.publishAt }),
        ...(metadata.madeForKids === null ? {} : { selfDeclaredMadeForKids: metadata.madeForKids }),
    },
})

/** The status members of a `video` resource (the `videos.list` item or the upload's answer). */
export const videoStatusOf = (item: unknown): YoutubeVideoStatus => {
    if (!isRecord(item)) return malformed("video")
    const videoId = textOf(item.id)
    if (videoId === null) return malformed("video id")
    const status = isRecord(item.status) ? item.status : null
    const processing = isRecord(item.processingDetails) ? item.processingDetails : null
    return {
        videoId,
        uploadStatus: textOf(status?.uploadStatus),
        reason: textOf(status?.failureReason) ?? textOf(status?.rejectionReason),
        privacyStatus: textOf(status?.privacyStatus),
        processingStatus: textOf(processing?.processingStatus),
    }
}

@Injectable()
/**
 * The one place that talks to the YouTube Data API v3. The access token is always explicit (the one of the Google connection), sent as a
 * bearer header only to Google's own origin (an upload session address on any other origin is refused before a byte leaves) and never
 * logged. Every failure is a `YoutubeError` whose code says WHERE it failed.
 */
export class YoutubeClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectYoutubeOptions() private readonly options: YoutubeOptions,
    ) {}

    /** The most bytes one upload may hold in memory. */
    get maxUploadBytes(): number {
        return this.options.maxUploadBytes
    }

    /**
     * `POST /upload/youtube/v3/videos?uploadType=resumable&part=snippet,status` with the video resource and the headers
     * `X-Upload-Content-Length` / `X-Upload-Content-Type` (https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol):
     * answers the session address of the `Location` header.
     */
    async startUpload(token: string, metadata: YoutubeUploadMetadata, size: number, contentType: string): Promise<string> {
        if (!Number.isInteger(size) || size < 1) return refusedArgument("size")
        const notify = metadata.notifySubscribers === null ? "" : `&notifySubscribers=${String(metadata.notifySubscribers)}`
        const answer = await this.send({
            method: "POST",
            url: `${this.options.apiBase}/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status${notify}`,
            headers: {
                authorization: `Bearer ${token}`,
                "content-type": "application/json; charset=UTF-8",
                "x-upload-content-length": String(size),
                "x-upload-content-type": contentType,
            },
            body: uploadBodyOf(metadata),
            timeoutMs: this.options.timeoutMs,
        })
        const location = textOf(answer.headers?.location)
        if (location === null || !this.isApiOrigin(location)) return malformed("upload session address")
        return location
    }

    /** `PUT {Location}` with the file: 201 (or 200) answers the created `video` resource; anything else, such as a 308, is a failure. */
    async upload(token: string, sessionUri: string, bytes: Buffer, contentType: string): Promise<YoutubeVideoStatus> {
        if (!this.isApiOrigin(sessionUri)) return refusedArgument("upload session address")
        const answer = await this.send({
            method: "PUT",
            url: sessionUri,
            headers: { authorization: `Bearer ${token}`, "content-type": contentType },
            bytes,
            timeoutMs: this.options.uploadTimeoutMs,
        })
        return videoStatusOf(answer.body)
    }

    /**
     * `POST /youtube/v3/playlistItems?part=snippet` with `snippet.playlistId` and `snippet.resourceId` (`kind` `youtube#video`, `videoId`)
     * (https://developers.google.com/youtube/v3/docs/playlistItems/insert): the playlist item's `id`.
     */
    async addToPlaylist(token: string, playlistId: string, videoId: string): Promise<string> {
        if (!YOUTUBE_ID.test(playlistId) || !YOUTUBE_ID.test(videoId)) return refusedArgument("id")
        const answer = await this.send({
            method: "POST",
            url: `${this.options.apiBase}/youtube/v3/playlistItems?part=snippet`,
            headers: { authorization: `Bearer ${token}` },
            body: { snippet: { playlistId, resourceId: { kind: "youtube#video", videoId } } },
            timeoutMs: this.options.timeoutMs,
        })
        const id = isRecord(answer.body) ? textOf(answer.body.id) : null
        return id ?? malformed("playlist item id")
    }

    /** `GET /youtube/v3/videos?part=status,processingDetails&id=` (https://developers.google.com/youtube/v3/docs/videos/list): the video's status; no item is `NotFound`. */
    async video(token: string, videoId: string): Promise<YoutubeVideoStatus> {
        if (!YOUTUBE_ID.test(videoId)) return refusedArgument("id")
        const answer = await this.send({
            method: "GET",
            url: `${this.options.apiBase}/youtube/v3/videos?part=status,processingDetails&id=${videoId}`,
            headers: { authorization: `Bearer ${token}` },
            timeoutMs: this.options.timeoutMs,
        })
        const items = isRecord(answer.body) && Array.isArray(answer.body.items) ? answer.body.items : null
        if (items === null) return malformed("items")
        if (items.length === 0) throw new YoutubeError({ code: YoutubeErrorCode.NotFound, params: { status: 200, reason: "videoNotFound", detail: "" } })
        return videoStatusOf(items[0])
    }

    /** True for an https address on the API's own origin: the bearer token goes nowhere else. */
    private isApiOrigin(address: string): boolean {
        if (!URL.canParse(address) || !URL.canParse(this.options.apiBase)) return false
        const target = new URL(address)
        return target.protocol === "https:" && target.origin === new URL(this.options.apiBase).origin
    }

    /** Sends one request: a transport failure is `Unreachable` (it may have left), an answered failure is typed. */
    private async send(request: HttpRequest): Promise<HttpResponse> {
        const answer = await this.http.request(request).catch((cause: unknown) => {
            throw new YoutubeError({ code: YoutubeErrorCode.Unreachable, cause })
        })
        if (statusClassOf(answer.status) !== "ok") throw answeredFailure(answer)
        return answer
    }
}
