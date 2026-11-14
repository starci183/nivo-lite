import { Injectable } from "@nestjs/common"
import { InjectHttpClient, type HttpClient, type HttpRequest, type HttpResponse } from "@modules/platform/http"
import { isRecord } from "@modules/platform/primitives"
import { cutDetail, retryAfterSecondsOf, statusClassOf } from "@modules/integrations/provider-http"
import { ShotstackError, ShotstackErrorCode } from "./errors/shotstack.error"
import {
    SHOTSTACK_RENDER_STATES,
    type ShotstackEdit,
    type ShotstackEnvironment,
    type ShotstackQueued,
    type ShotstackRender,
    type ShotstackRenderState,
} from "./shotstack.contracts"
import { InjectShotstackOptions } from "./shotstack.decorators"
import type { ShotstackOptions } from "./shotstack.options"

/** The header that carries the API key (https://shotstack.io/docs/api/: "Set the x-api-key header with your provided key"). */
const KEY_HEADER = "x-api-key"

/** A render id is a UUID (https://shotstack.io/docs/api/, GET /render/{id}: path parameter `id`, UUID). */
const RENDER_ID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/u

const textOf = (value: unknown): string | null =>
    typeof value === "string" && value.trim() !== "" ? value.trim() : null

/**
 * Shotstack's words on a failed call. The reference describes the envelope `{ success, message, response }` (`message`: "`Bad Request` or
 * an error message"; `response.message`: "Success response message or error details"); the rate-limit error type is named
 * `rate_limit_error` (https://shotstack.io/docs/guide/architecting-an-application/limitations/). The exact error bodies are NOT in the
 * docs, so every documented member that may carry words is read, in order: `response` (text), `response.message`, `message`, `error`
 * (text) or `error.message`.
 */
export const shotstackErrorOf = (body: unknown): string => {
    if (!isRecord(body)) return ""
    const response = isRecord(body.response) ? body.response : null
    const error = isRecord(body.error) ? body.error : null
    return (
        cutDetail(body.response) ?? cutDetail(response?.message) ?? cutDetail(response?.error) ?? cutDetail(body.message) ??
        cutDetail(body.error) ?? cutDetail(error?.message) ?? ""
    )
}

/** The typed failure of an answered status that is no success: by the status' class alone. */
const answeredFailure = (answer: HttpResponse): ShotstackError => {
    const status = answer.status
    const params = { status, detail: shotstackErrorOf(answer.body) }
    switch (statusClassOf(status)) {
        case "auth":
            return new ShotstackError({ code: ShotstackErrorCode.AuthFailed, params })
        case "rate_limited":
            return new ShotstackError({
                code: ShotstackErrorCode.RateLimited,
                params: { ...params, retryAfterSeconds: retryAfterSecondsOf(answer.headers) },
            })
        case "not_found":
            return new ShotstackError({ code: ShotstackErrorCode.NotFound, params })
        case "rejected":
            return new ShotstackError({ code: ShotstackErrorCode.Rejected, params })
        case "ok":
        case "server":
        default:
            return new ShotstackError({ code: ShotstackErrorCode.Failed, params })
    }
}

const malformed = (what: string): never => {
    throw new ShotstackError({ code: ShotstackErrorCode.Malformed, params: { what } })
}

/** The state word of a status body, or null for a word the docs do not list. */
const stateOf = (value: unknown): ShotstackRenderState | null =>
    SHOTSTACK_RENDER_STATES.find((state) => state === value) ?? null

/** The id of a queued render: `response.id` of the 201 body `{ success, message, response: { message, id } }`. */
export const shotstackQueuedOf = (body: unknown): ShotstackQueued => {
    const response = isRecord(body) && isRecord(body.response) ? body.response : null
    const id = textOf(response?.id)
    return id === null ? malformed("render id") : { id }
}

/**
 * A render as `GET /render/{id}` answers it: `response.status` (one of the documented words), `response.url` (only once `done`) and
 * `response.error` (only when it failed).
 */
export const shotstackRenderOf = (body: unknown): ShotstackRender => {
    const response = isRecord(body) && isRecord(body.response) ? body.response : null
    if (response === null) return malformed("render")
    const id = textOf(response.id)
    const status = stateOf(response.status)
    if (id === null) return malformed("render id")
    if (status === null) return malformed("render status")
    return { id, status, url: textOf(response.url), error: cutDetail(response.error) }
}

@Injectable()
/**
 * The one place that talks to Shotstack's Edit API (https://shotstack.io/docs/api/). The API key is always explicit (the key of one
 * connection), sent only in header `x-api-key` and never logged; the environment (`stage` or `v1`) picks the path segment. Every failure
 * is a `ShotstackError` whose code says WHERE it failed.
 */
export class ShotstackClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectShotstackOptions() private readonly options: ShotstackOptions,
    ) {}

    /** `POST {base}/{environment}/render` with the Edit as the JSON body: answers the queued render's id (201). */
    async render(apiKey: string, environment: ShotstackEnvironment, edit: ShotstackEdit): Promise<ShotstackQueued> {
        const answer = await this.send({
            method: "POST",
            url: `${this.options.apiBase}/${environment}/render`,
            headers: { [KEY_HEADER]: apiKey },
            body: edit,
            timeoutMs: this.options.timeoutMs,
        })
        return shotstackQueuedOf(answer.body)
    }

    /** `GET {base}/{environment}/render/{id}?data=false`: the render as it stands (`data=false` leaves out the echoed Edit). */
    async renderStatus(apiKey: string, environment: ShotstackEnvironment, renderId: string): Promise<ShotstackRender> {
        if (!RENDER_ID.test(renderId)) {
            throw new ShotstackError({ code: ShotstackErrorCode.Rejected, params: { status: 0, detail: "render id" } })
        }
        const answer = await this.send({
            method: "GET",
            url: `${this.options.apiBase}/${environment}/render/${renderId}?data=false`,
            headers: { [KEY_HEADER]: apiKey },
            timeoutMs: this.options.timeoutMs,
        })
        return shotstackRenderOf(answer.body)
    }

    /** Sends one request: a transport failure is `Unreachable` (it may have left), an answered failure is typed by its status. */
    private async send(request: HttpRequest): Promise<HttpResponse> {
        const answer = await this.http.request(request).catch((cause: unknown) => {
            throw new ShotstackError({ code: ShotstackErrorCode.Unreachable, cause })
        })
        if (statusClassOf(answer.status) !== "ok") throw answeredFailure(answer)
        return answer
    }
}
