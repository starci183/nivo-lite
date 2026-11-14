import { Injectable } from "@nestjs/common"
import { InjectHttpClient, type HttpClient, type HttpRequest, type HttpResponse } from "@modules/platform/http"
import { isRecord } from "@modules/platform/primitives"
import { cutDetail, retryAfterSecondsOf, statusClassOf } from "@modules/integrations/provider-http"
import { MetaPublishingError, MetaPublishingErrorCode } from "./errors/meta-publishing.error"
import {
    CONTAINER_STATUS_CODES,
    type ContainerRequest,
    type ContainerStatusCode,
    type FeedPostAnswer,
    type FeedPostRequest,
    type MetaPublishingAccess,
    type PhotoPostAnswer,
    type PhotoPostRequest,
    type VideoPostAnswer,
    type VideoPostRequest,
} from "./meta-publishing.contracts"
import { InjectMetaPublishingOptions } from "./meta-publishing.decorators"
import type { MetaPublishingOptions } from "./meta-publishing.options"

/** An object id as a path segment takes it (a Page, an Instagram account, a container): letters, digits and underscores only. */
const OBJECT_ID = /^\w{1,64}$/u

/** The Graph error codes the error-handling page documents, by what they ask of the caller (https://developers.facebook.com/docs/graph-api/guides/error-handling). */
const AUTH_CODES: ReadonlySet<number> = new Set([190, 102, 10, 3])
const RATE_CODES: ReadonlySet<number> = new Set([4, 17, 341])
const OUTAGE_CODES: ReadonlySet<number> = new Set([1, 2])
/** The documented "range of codes depending on the permission": 200 to 299. */
const isPermissionCode = (code: number): boolean => code >= 200 && code <= 299

const textOf = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null)

/** The numeric code and the words of Graph's error body. */
export interface GraphErrorBody {
    /** `error.code`, or null when the body names none. */
    readonly code: number | null
    /** Graph's own words; "" when the body has none. */
    readonly message: string
}

/** Graph's error body (`{ error: { message, type, code, error_subcode, fbtrace_id } }`): its numeric code and words. */
export const graphErrorOf = (body: unknown): GraphErrorBody => {
    const error = isRecord(body) && isRecord(body.error) ? body.error : null
    return { code: typeof error?.code === "number" ? error.code : null, message: cutDetail(error?.message) ?? "" }
}

/**
 * The typed failure of an answered status that is no success: by Graph's numeric `error.code` first (the documented table), then by the
 * status' class alone. Never by Meta's words.
 */
const answeredFailure = (answer: HttpResponse): MetaPublishingError => {
    const status = answer.status
    const { code, message } = graphErrorOf(answer.body)
    const params = { status, code: code ?? 0, detail: message }
    if (code !== null && (AUTH_CODES.has(code) || isPermissionCode(code))) {
        return new MetaPublishingError({ code: MetaPublishingErrorCode.AuthFailed, params })
    }
    if (code !== null && RATE_CODES.has(code)) {
        return new MetaPublishingError({ code: MetaPublishingErrorCode.RateLimited, params: { ...params, retryAfterSeconds: retryAfterSecondsOf(answer.headers) } })
    }
    if (code !== null && OUTAGE_CODES.has(code)) return new MetaPublishingError({ code: MetaPublishingErrorCode.Failed, params })
    switch (statusClassOf(status)) {
        case "auth":
            return new MetaPublishingError({ code: MetaPublishingErrorCode.AuthFailed, params })
        case "rate_limited":
            return new MetaPublishingError({ code: MetaPublishingErrorCode.RateLimited, params: { ...params, retryAfterSeconds: retryAfterSecondsOf(answer.headers) } })
        case "not_found":
            return new MetaPublishingError({ code: MetaPublishingErrorCode.NotFound, params })
        case "rejected":
            return new MetaPublishingError({ code: MetaPublishingErrorCode.Rejected, params })
        case "ok":
        case "server":
        default:
            return new MetaPublishingError({ code: MetaPublishingErrorCode.Failed, params })
    }
}

const malformed = (what: string): never => {
    throw new MetaPublishingError({ code: MetaPublishingErrorCode.Malformed, params: { what } })
}

/** The refusal of an id NIVO will not put on a URL: nothing was sent. */
const refusedId = (what: string): never => {
    throw new MetaPublishingError({ code: MetaPublishingErrorCode.Rejected, params: { status: 0, code: 0, detail: what } })
}

const idOf = (body: unknown, what: string): string => {
    const id = isRecord(body) ? textOf(body.id) : null
    return id ?? malformed(what)
}

/** The documented `status_code` of a container, or a malformed answer for any other word. */
export const containerStatusOf = (body: unknown): ContainerStatusCode => {
    const word = isRecord(body) ? textOf(body.status_code) : null
    const known = CONTAINER_STATUS_CODES.find((code) => code === word)
    return known ?? malformed("container status_code")
}

/** The form fields of a container request: only what is set, under the documented names. */
export const containerFormOf = (request: ContainerRequest): Record<string, string> => ({
    ...(request.mediaType === null ? {} : { media_type: request.mediaType }),
    ...(request.imageUrl === null ? {} : { image_url: request.imageUrl }),
    ...(request.videoUrl === null ? {} : { video_url: request.videoUrl }),
    ...(request.caption === null ? {} : { caption: request.caption }),
    ...(request.altText === null ? {} : { alt_text: request.altText }),
    ...(request.isCarouselItem === null ? {} : { is_carousel_item: String(request.isCarouselItem) }),
    ...(request.children.length === 0 ? {} : { children: request.children.join(",") }),
    ...(request.aiGenerated === null ? {} : { is_ai_generated: String(request.aiGenerated) }),
})

@Injectable()
/**
 * The one place that publishes to Facebook Pages and Instagram through the Graph API. The token is always explicit (the Page token of
 * one connection), sent as the `access_token` field of a POST (the reference pages' own example) or as a bearer header on the status
 * read (the content publishing guide's example), never in a URL and never logged. Every failure is a `MetaPublishingError` whose code says
 * WHERE it failed.
 */
export class MetaPublishingClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectMetaPublishingOptions() private readonly options: MetaPublishingOptions,
    ) {}

    /** `POST /{page-id}/feed` with `message` and / or `link` (https://developers.facebook.com/docs/graph-api/reference/page/feed/): `{ id }`. */
    async postFeed(access: MetaPublishingAccess, request: FeedPostRequest): Promise<FeedPostAnswer> {
        const answer = await this.post(access, `${this.idOf(access.pageId)}/feed`, {
            ...(request.message === null ? {} : { message: request.message }),
            ...(request.link === null ? {} : { link: request.link }),
        })
        return { id: idOf(answer.body, "feed post id") }
    }

    /** `POST /{page-id}/photos` with `url` and `caption` (https://developers.facebook.com/docs/graph-api/reference/page/photos/): `{ id, post_id }`. */
    async postPhoto(access: MetaPublishingAccess, request: PhotoPostRequest): Promise<PhotoPostAnswer> {
        const answer = await this.post(access, `${this.idOf(access.pageId)}/photos`, {
            url: request.url,
            ...(request.caption === null ? {} : { caption: request.caption }),
        })
        return { id: idOf(answer.body, "photo id"), postId: isRecord(answer.body) ? textOf(answer.body.post_id) : null }
    }

    /** `POST /{page-id}/videos` with `file_url`, `description`, `title` (https://developers.facebook.com/docs/graph-api/reference/page/videos/): `{ id }`. */
    async postVideo(access: MetaPublishingAccess, request: VideoPostRequest): Promise<VideoPostAnswer> {
        const answer = await this.post(access, `${this.idOf(access.pageId)}/videos`, {
            file_url: request.fileUrl,
            ...(request.description === null ? {} : { description: request.description }),
            ...(request.title === null ? {} : { title: request.title }),
        })
        return { id: idOf(answer.body, "video id") }
    }

    /** `POST /{ig-id}/media` (https://developers.facebook.com/docs/instagram-platform/content-publishing): the container id. */
    async createContainer(access: MetaPublishingAccess, request: ContainerRequest): Promise<string> {
        const answer = await this.post(access, `${this.idOf(access.igId ?? "")}/media`, containerFormOf(request))
        return idOf(answer.body, "container id")
    }

    /** `POST /{ig-id}/media_publish` with `creation_id`: the published media id. */
    async publishContainer(access: MetaPublishingAccess, containerId: string): Promise<string> {
        const answer = await this.post(access, `${this.idOf(access.igId ?? "")}/media_publish`, { creation_id: this.idOf(containerId) })
        return idOf(answer.body, "media id")
    }

    /** `GET /{container-id}?fields=status_code`: the container's documented status word. */
    async containerStatus(access: MetaPublishingAccess, containerId: string): Promise<ContainerStatusCode> {
        const answer = await this.send({
            method: "GET",
            url: `${this.options.graphBase}/${this.idOf(containerId)}?fields=status_code`,
            headers: { authorization: `Bearer ${access.token}` },
            timeoutMs: this.options.timeoutMs,
        })
        return containerStatusOf(answer.body)
    }

    private idOf(id: string): string {
        return OBJECT_ID.test(id) ? id : refusedId("id")
    }

    private post(access: MetaPublishingAccess, path: string, fields: Record<string, string>): Promise<HttpResponse> {
        return this.send({
            method: "POST",
            url: `${this.options.graphBase}/${path}`,
            form: { ...fields, access_token: access.token },
            timeoutMs: this.options.timeoutMs,
        })
    }

    /** Sends one request: a transport failure is `Unreachable` (it may have left), an answered failure is typed. */
    private async send(request: HttpRequest): Promise<HttpResponse> {
        const answer = await this.http.request(request).catch((cause: unknown) => {
            throw new MetaPublishingError({ code: MetaPublishingErrorCode.Unreachable, cause })
        })
        if (statusClassOf(answer.status) !== "ok") throw answeredFailure(answer)
        return answer
    }
}
