import { Injectable } from "@nestjs/common"
import { InjectHttpClient, type HttpClient, type HttpRequest, type HttpResponse } from "@modules/platform/http"
import { eachInOrder, isRecord, parseJsonText } from "@modules/platform/primitives"
import { cutDetail, retryAfterSecondsOf, statusClassOf } from "@modules/integrations/provider-http"
import { TiktokError, TiktokErrorCode } from "./errors/tiktok.error"
import {
    TIKTOK_CHUNK_MAX,
    TIKTOK_VIDEO_BYTES_MAX,
    type TiktokChunkPlan,
    type TiktokCreatorInfo,
    type TiktokInitRequest,
    type TiktokInitResult,
    type TiktokPublishStatus,
    type TiktokTokens,
} from "./tiktok.contracts"
import { InjectTiktokOptions } from "./tiktok.decorators"
import type { TiktokOptions } from "./tiktok.options"

const JSON_UTF8 = "application/json; charset=UTF-8"

/** The documented OAuth error categories that mean the refresh token itself is dead or the app is unknown (https://developers.tiktok.com/doc/oauth-error-handling). */
const DEAD_GRANT: ReadonlySet<string> = new Set(["invalid_grant", "invalid_client", "unauthorized_client"])

const textOf = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null)

const numberOf = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null)

const malformed = (what: string): never => {
    throw new TiktokError({ code: TiktokErrorCode.Malformed, params: { what } })
}

/** The refusal of an argument NIVO will not send (nothing left): a file that cannot be planned, an upload address of another origin. */
const refusedArgument = (what: string): never => {
    throw new TiktokError({ code: TiktokErrorCode.Rejected, params: { status: 0, word: "", detail: what } })
}

/**
 * The body of an answer as JSON: a status/fetch body is read as text so its int64 post ids never pass through a double (`quoteIds`), the
 * others arrive parsed.
 */
const jsonOf = (body: unknown): unknown => {
    if (typeof body !== "string") return body
    const read = parseJsonText(body)
    return read.ok ? read.value : null
}

/**
 * The text of a status/fetch answer with the digits of `publicaly_available_post_id` (the documentation's spelling) quoted, so an int64 id
 * parses as a string and keeps every digit. A format step on the member's array only; it reads no meaning.
 */
export const quoteIds = (text: string): string =>
    text.replace(/("publicaly_available_post_id"\s*:\s*\[)([^\]]*)\]/u, (_all, head: string, list: string) => {
        const quoted = list.replaceAll(/-?\d+/gu, (digits) => `"${digits}"`)
        return `${head}${quoted}]`
    })

/** The code word and the words of a TikTok error. */
export interface TiktokErrorBody {
    /** The error's code word (`error.code`, or OAuth's `error`); "" when none. */
    readonly word: string
    /** TikTok's own words; "" when none. */
    readonly message: string
}

/**
 * TikTok's error: the Content Posting API's `{ error: { code, message, log_id } }` (`ok` is success) or OAuth's `{ error, error_description,
 * log_id }`: its code word and its words.
 */
export const tiktokErrorOf = (body: unknown): TiktokErrorBody => {
    if (!isRecord(body)) return { word: "", message: "" }
    if (isRecord(body.error)) return { word: textOf(body.error.code) ?? "", message: cutDetail(body.error.message) ?? "" }
    return { word: textOf(body.error) ?? "", message: cutDetail(body.error_description) ?? "" }
}

/** The typed failure of an answered status that is no success: 401 the token, 429 the rate, 404, 5xx it may have acted, any other 4xx a refusal. */
const answeredFailure = (answer: HttpResponse): TiktokError => {
    const status = answer.status
    const { word, message } = tiktokErrorOf(jsonOf(answer.body))
    const params = { status, word, detail: message }
    if (status === 401) return new TiktokError({ code: TiktokErrorCode.AuthFailed, params })
    switch (statusClassOf(status)) {
        case "rate_limited":
            return new TiktokError({ code: TiktokErrorCode.RateLimited, params: { ...params, retryAfterSeconds: retryAfterSecondsOf(answer.headers) } })
        case "not_found":
            return new TiktokError({ code: TiktokErrorCode.NotFound, params })
        case "auth":
        case "rejected":
            return new TiktokError({ code: TiktokErrorCode.Rejected, params })
        case "ok":
        case "server":
        default:
            return new TiktokError({ code: TiktokErrorCode.Failed, params })
    }
}

/** The `data` object of a Content Posting API success; a 200 whose `error.code` is not `ok` is TikTok's refusal. */
const dataOf = (status: number, body: unknown): Readonly<Record<string, unknown>> => {
    if (!isRecord(body)) return malformed("body")
    const { word, message } = tiktokErrorOf(body)
    if (word !== "" && word !== "ok") {
        throw new TiktokError({ code: TiktokErrorCode.Rejected, params: { status, word, detail: message } })
    }
    return isRecord(body.data) ? body.data : malformed("data")
}

/** Creator info (https://developers.tiktok.com/doc/content-posting-api-reference-query-creator-info, response members). */
export const tiktokCreatorOf = (status: number, body: unknown): TiktokCreatorInfo => {
    const data = dataOf(status, body)
    const options = Array.isArray(data.privacy_level_options)
        ? data.privacy_level_options.filter((option): option is string => typeof option === "string")
        : []
    return {
        username: textOf(data.creator_username) ?? "",
        nickname: textOf(data.creator_nickname) ?? "",
        privacyLevelOptions: options,
        commentDisabled: data.comment_disabled === true,
        duetDisabled: data.duet_disabled === true,
        stitchDisabled: data.stitch_disabled === true,
        maxVideoPostDurationSec: numberOf(data.max_video_post_duration_sec),
    }
}

/** The answer of a direct post init: `data.publish_id` and, for FILE_UPLOAD, `data.upload_url`. */
export const tiktokInitOf = (status: number, body: unknown): TiktokInitResult => {
    const data = dataOf(status, body)
    const publishId = textOf(data.publish_id)
    return publishId === null ? malformed("publish_id") : { publishId, uploadUrl: textOf(data.upload_url) }
}

/** The status of a post: `data.status`, `fail_reason`, `publicaly_available_post_id`, `uploaded_bytes`, `downloaded_bytes`. */
export const tiktokStatusOf = (status: number, body: unknown): TiktokPublishStatus => {
    const data = dataOf(status, body)
    const state = textOf(data.status)
    if (state === null) return malformed("status")
    const ids = Array.isArray(data.publicaly_available_post_id) ? data.publicaly_available_post_id : []
    return {
        status: state,
        failReason: textOf(data.fail_reason),
        postIds: ids.flatMap((id: unknown) => (typeof id === "string" || typeof id === "number" ? [String(id)] : [])),
        uploadedBytes: numberOf(data.uploaded_bytes),
        downloadedBytes: numberOf(data.downloaded_bytes),
    }
}

/**
 * The chunks of a file (media transfer guide: https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide): up to 64 MB is one
 * chunk (a file under 5 MB MUST be one, `chunk_size` = the file size); over 64 MB it is cut in 64 MB chunks, `total_chunk_count` the size
 * divided by the chunk rounded down, the last chunk absorbing the trailing bytes (up to 128 MB). A file of no bytes or over 4 GB is refused.
 */
export const chunkPlanOf = (videoSize: number): TiktokChunkPlan => {
    if (!Number.isInteger(videoSize) || videoSize <= 0 || videoSize > TIKTOK_VIDEO_BYTES_MAX) return refusedArgument("video size")
    if (videoSize <= TIKTOK_CHUNK_MAX) return { videoSize, chunkSize: videoSize, totalChunkCount: 1 }
    return { videoSize, chunkSize: TIKTOK_CHUNK_MAX, totalChunkCount: Math.floor(videoSize / TIKTOK_CHUNK_MAX) }
}

/** One byte range of a chunked upload, first and last byte inclusive. */
export interface ChunkRange {
    /** The first byte of the chunk. */
    readonly first: number
    /** The last byte of the chunk. */
    readonly last: number
}

/** The byte ranges of a plan, first and last byte inclusive (`Content-Range: bytes first-last/total`); the last range ends at the file's end. */
export const chunkRangesOf = (plan: TiktokChunkPlan): ReadonlyArray<ChunkRange> =>
    Array.from({ length: plan.totalChunkCount }, (_unused, index) => ({
        first: index * plan.chunkSize,
        last: index === plan.totalChunkCount - 1 ? plan.videoSize - 1 : (index + 1) * plan.chunkSize - 1,
    }))

/** The post_info + source_info body of a direct post init, only the members that were given. */
const initBodyOf = (request: TiktokInitRequest): Readonly<Record<string, unknown>> => ({
    post_info: {
        privacy_level: request.privacyLevel,
        ...(request.title === null ? {} : { title: request.title }),
        ...(request.disableDuet === null ? {} : { disable_duet: request.disableDuet }),
        ...(request.disableStitch === null ? {} : { disable_stitch: request.disableStitch }),
        ...(request.disableComment === null ? {} : { disable_comment: request.disableComment }),
        ...(request.coverTimestampMs === null ? {} : { video_cover_timestamp_ms: request.coverTimestampMs }),
        ...(request.brandContentToggle === null ? {} : { brand_content_toggle: request.brandContentToggle }),
        ...(request.brandOrganicToggle === null ? {} : { brand_organic_toggle: request.brandOrganicToggle }),
        ...(request.isAigc === null ? {} : { is_aigc: request.isAigc }),
    },
    source_info:
        request.source.kind === "pull"
            ? { source: "PULL_FROM_URL", video_url: request.source.videoUrl }
            : {
                  source: "FILE_UPLOAD",
                  video_size: request.source.plan.videoSize,
                  chunk_size: request.source.plan.chunkSize,
                  total_chunk_count: request.source.plan.totalChunkCount,
              },
})

@Injectable()
/**
 * The one place that talks to the TikTok Content Posting API (https://developers.tiktok.com/doc/content-posting-api-get-started). The user
 * access token is always explicit (one connection's) and never logged; it is sent only to the API's own origin. Every failure is a
 * `TiktokError` whose code says WHERE it failed.
 */
export class TiktokClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectTiktokOptions() private readonly options: TiktokOptions,
    ) {}

    /** `POST /v2/post/publish/creator_info/query/` (no body): what this creator may post with. */
    async creatorInfo(accessToken: string): Promise<TiktokCreatorInfo> {
        const answer = await this.send(this.jsonCall("/v2/post/publish/creator_info/query/", accessToken, undefined))
        return tiktokCreatorOf(answer.status, jsonOf(answer.body))
    }

    /** `POST /v2/post/publish/video/init/`: starts one direct post; answers the `publish_id` (and the `upload_url` of a FILE_UPLOAD). */
    async initPost(accessToken: string, request: TiktokInitRequest): Promise<TiktokInitResult> {
        const answer = await this.send(this.jsonCall("/v2/post/publish/video/init/", accessToken, initBodyOf(request)))
        return tiktokInitOf(answer.status, jsonOf(answer.body))
    }

    /**
     * `PUT {upload_url}` once per chunk, in order (media transfer guide): `Content-Type`, `Content-Length`, `Content-Range:
     * bytes first-last/total`. The address must be https on TikTok's own domain (or the API's origin): the bytes never go elsewhere.
     * The last answer must be 201 (all parts uploaded; 206 means more chunks remain).
     */
    async uploadVideo(uploadUrl: string, bytes: Buffer, contentType: string, plan: TiktokChunkPlan): Promise<void> {
        if (!this.isUploadAddress(uploadUrl) || bytes.length !== plan.videoSize) return refusedArgument("upload")
        const ranges = chunkRangesOf(plan)
        await eachInOrder(ranges, async (range, index) => {
            const part = bytes.subarray(range.first, range.last + 1)
            const answer = await this.send({
                method: "PUT",
                url: uploadUrl,
                headers: {
                    "content-type": contentType,
                    "content-length": String(part.length),
                    "content-range": `bytes ${range.first}-${range.last}/${plan.videoSize}`,
                },
                bytes: part,
                timeoutMs: this.options.uploadTimeoutMs,
            })
            if (index === ranges.length - 1 && answer.status !== 201) malformed("upload incomplete")
        })
    }

    /** `POST /v2/post/publish/status/fetch/` with `{ publish_id }`: where one post stands. */
    async status(accessToken: string, publishId: string): Promise<TiktokPublishStatus> {
        const answer = await this.send({ ...this.jsonCall("/v2/post/publish/status/fetch/", accessToken, { publish_id: publishId }), read: "text" })
        return tiktokStatusOf(answer.status, jsonOf(typeof answer.body === "string" ? quoteIds(answer.body) : answer.body))
    }

    /**
     * `POST /v2/oauth/token/` form `client_key`, `client_secret`, `grant_type=refresh_token`, `refresh_token`
     * (https://developers.tiktok.com/doc/oauth-refresh-a-user-access-token): the new access token and the new refresh token (the old one
     * is dead). Without an app client on this deployment nothing is sent.
     */
    async refresh(refreshToken: string): Promise<TiktokTokens> {
        const client = this.options.client
        if (client === null) throw new TiktokError({ code: TiktokErrorCode.NotConfigured })
        const answer = await this.send({
            method: "POST",
            url: `${this.options.apiBase}/v2/oauth/token/`,
            form: {
                client_key: client.clientKey,
                client_secret: client.clientSecret.reveal(),
                grant_type: "refresh_token",
                refresh_token: refreshToken,
            },
            timeoutMs: this.options.timeoutMs,
        }).catch((cause: unknown) => {
            if (cause instanceof TiktokError && cause.code === TiktokErrorCode.Rejected && DEAD_GRANT.has(String(cause.params.word))) {
                throw new TiktokError({ code: TiktokErrorCode.AuthFailed, params: cause.params, cause })
            }
            throw cause
        })
        const body = answer.body
        if (!isRecord(body)) return malformed("token")
        const accessToken = textOf(body.access_token)
        const next = textOf(body.refresh_token)
        const expires = numberOf(body.expires_in)
        if (accessToken === null || next === null || expires === null) return malformed("token members")
        return { accessToken, refreshToken: next, expiresInSeconds: expires }
    }

    private jsonCall(path: string, accessToken: string, body: unknown): HttpRequest {
        return {
            method: "POST",
            url: `${this.options.apiBase}${path}`,
            headers: { authorization: `Bearer ${accessToken}`, "content-type": JSON_UTF8 },
            ...(body === undefined ? {} : { body }),
            timeoutMs: this.options.timeoutMs,
        }
    }

    /** True for an https address on TikTok's own domain or the API's own origin. */
    private isUploadAddress(address: string): boolean {
        if (!URL.canParse(address) || !URL.canParse(this.options.apiBase)) return false
        const target = new URL(address)
        return (
            target.protocol === "https:" &&
            (target.hostname.endsWith(".tiktokapis.com") || target.origin === new URL(this.options.apiBase).origin)
        )
    }

    /** Sends one request: a transport failure is `Unreachable` (it may have left), an answered failure is typed by its status. */
    private async send(request: HttpRequest): Promise<HttpResponse> {
        const answer = await this.http.request(request).catch((cause: unknown) => {
            throw new TiktokError({ code: TiktokErrorCode.Unreachable, cause })
        })
        if (statusClassOf(answer.status) !== "ok") throw answeredFailure(answer)
        return answer
    }
}
