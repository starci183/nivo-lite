import { Injectable } from "@nestjs/common"
import { InjectHttpClient, type HttpClient, type HttpRequest, type HttpResponse } from "@modules/platform/http"
import { isRecord } from "@modules/platform/primitives"
import { cutDetail, retryAfterSecondsOf, statusClassOf } from "@modules/integrations/provider-http"
import { CreatomateError, CreatomateErrorCode } from "./errors/creatomate.error"
import { CREATOMATE_STATUSES, type CreatomateRender, type CreatomateRenderRequest, type CreatomateStatus } from "./creatomate.contracts"
import { InjectCreatomateOptions } from "./creatomate.decorators"
import type { CreatomateOptions } from "./creatomate.options"

/** A render id as a path segment takes it (the docs' ids are UUIDs: `a862048b-d0dc-4029-a4ef-e172e8ded827`). */
const RENDER_ID = /^[A-Za-z0-9-]{1,200}$/u

const textOf = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null)

/** The bearer value of the key (https://creatomate.com/llms/quick-start.md: `Authorization: Bearer YOUR_API_KEY`). */
const bearerOf = (apiKey: string): string => `Bearer ${apiKey}`

/** Creatomate's error body (`{ hint, documentation }`, https://creatomate.com/docs/api/reference/introduction): the hint, cut. */
export const creatomateHintOf = (body: unknown): string => (isRecord(body) ? (cutDetail(body.hint) ?? "") : "")

/**
 * A render object as the API answers it (a start's 202, a status read and the webhook body share it:
 * https://creatomate.com/docs/api/reference/what-is-a-render): `id` and a known `status`, else null. `url` and `error_message` are read
 * when they are text.
 */
export const creatomateRenderOf = (body: unknown): CreatomateRender | null => {
    if (!isRecord(body)) return null
    const id = textOf(body.id)
    const status = CREATOMATE_STATUSES.find((word: CreatomateStatus) => word === body.status)
    if (id === null || status === undefined) return null
    return { id, status, url: textOf(body.url), errorMessage: cutDetail(body.error_message) }
}

/** The typed failure of an answered status that is no success: by the status' class alone. */
const answeredFailure = (answer: HttpResponse): CreatomateError => {
    const status = answer.status
    const params = { status, detail: creatomateHintOf(answer.body) }
    switch (statusClassOf(status)) {
        case "auth":
            return new CreatomateError({ code: CreatomateErrorCode.AuthFailed, params })
        case "rate_limited":
            return new CreatomateError({ code: CreatomateErrorCode.RateLimited, params: { ...params, retryAfterSeconds: retryAfterSecondsOf(answer.headers) } })
        case "not_found":
            return new CreatomateError({ code: CreatomateErrorCode.NotFound, params })
        case "rejected":
            return new CreatomateError({ code: CreatomateErrorCode.Rejected, params })
        case "ok":
        case "server":
            return new CreatomateError({ code: CreatomateErrorCode.Failed, params })
    }
}

const readable = (body: unknown): CreatomateRender => {
    const render = creatomateRenderOf(body)
    if (render === null) throw new CreatomateError({ code: CreatomateErrorCode.Malformed, params: { what: "render" } })
    return render
}

@Injectable()
/**
 * The one place that talks to Creatomate (https://creatomate.com/llms/api.md). The API key is always explicit (the key of one
 * connection) and never logged. Every failure is a `CreatomateError` whose code says WHERE it failed.
 */
export class CreatomateClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectCreatomateOptions() private readonly options: CreatomateOptions,
    ) {}

    /**
     * `POST {base}/v2/renders` with the RenderScript at the top level of the body (no `template_id`) and, when given, `webhook_url`
     * (https://creatomate.com/llms/api.md: "a raw RenderScript at the top level"; create-a-render: `webhook_url`). A success is 202 with
     * ONE render object.
     */
    async start(apiKey: string, request: CreatomateRenderRequest): Promise<CreatomateRender> {
        const answer = await this.send({
            method: "POST",
            url: `${this.options.apiBase}/v2/renders`,
            headers: { authorization: bearerOf(apiKey) },
            body: { ...request.source, ...(request.webhookUrl === null ? {} : { webhook_url: request.webhookUrl }) },
            timeoutMs: this.options.timeoutMs,
        })
        return readable(answer.body)
    }

    /** `GET {base}/v2/renders/{id}`: the render as it stands. */
    async render(apiKey: string, id: string): Promise<CreatomateRender> {
        if (!RENDER_ID.test(id)) {
            throw new CreatomateError({ code: CreatomateErrorCode.Rejected, params: { status: 0, detail: "render id" } })
        }
        const answer = await this.send({
            method: "GET",
            url: `${this.options.apiBase}/v2/renders/${id}`,
            headers: { authorization: bearerOf(apiKey) },
            timeoutMs: this.options.timeoutMs,
        })
        return readable(answer.body)
    }

    /** Sends one request: a transport failure is `Unreachable` (it may have left), an answered failure is typed by its status. */
    private async send(request: HttpRequest): Promise<HttpResponse> {
        const answer = await this.http.request(request).catch((cause: unknown) => {
            throw new CreatomateError({ code: CreatomateErrorCode.Unreachable, cause })
        })
        if (statusClassOf(answer.status) !== "ok") throw answeredFailure(answer)
        return answer
    }
}
