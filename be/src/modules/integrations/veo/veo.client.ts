import { Injectable } from "@nestjs/common"
import { InjectHttpClient, type HttpClient, type HttpRequest, type HttpResponse } from "@modules/platform/http"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { cutDetail, retryAfterSecondsOf, statusClassOf } from "@modules/integrations/provider-http"
import { VeoError, VeoErrorCode } from "./errors/veo.error"
import type { VeoGenerateRequest, VeoOperation, VeoVideo } from "./veo.contracts"
import { InjectVeoOptions } from "./veo.decorators"
import type { VeoOptions } from "./veo.options"

/** The header that carries the Gemini API key (the guide's REST examples: `x-goog-api-key`). */
const KEY_HEADER = "x-goog-api-key"

/** A model id as a path segment takes it (the guide's ids: `veo-3.1-generate-preview`, `veo-3.0-generate-001`). */
const MODEL_ID = /^[a-z0-9][a-z0-9.-]{0,79}$/u

/** An operation name as Google answers it under the model (`models/<model>/operations/<id>`): path segments only, no query. */
const OPERATION_NAME = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+){1,7}$/u

/** The redirect statuses a download follows once. */
const REDIRECTS: ReadonlySet<number> = new Set([301, 302, 303, 307, 308])

/** The address of a redirect, https only: any other scheme is refused before anything leaves. */
const httpsOf = (target: URL): string => (target.protocol === "https:" ? target.toString() : refusedArgument("redirect"))

const textOf = (value: unknown): string | null =>
    typeof value === "string" && value.trim() !== "" ? value.trim() : null

/** A body read as bytes (a download that failed answers JSON): parsed when it is JSON, else as it is. */
const jsonOf = (body: unknown): unknown => {
    if (!Buffer.isBuffer(body)) return body
    const read = parseJsonText(body.toString("utf8"))
    return read.ok ? read.value : null
}

/** The status word and the words of Google's error body. */
export interface VeoErrorBody {
    /** `error.status`; "" when the body names none. */
    readonly status: string
    /** Google's own words; "" when the body has none. */
    readonly message: string
}

/** Google's error body (`{ error: { code, message, status } }`, https://aistudio.google.com/docs/api-errors.md): its status word and words. */
export const veoErrorOf = (body: unknown): VeoErrorBody => {
    const error = isRecord(body) && isRecord(body.error) ? body.error : null
    return { status: textOf(error?.status) ?? "", message: cutDetail(error?.message) ?? "" }
}

/** The typed failure of an answered status that is no success: by the status' class alone. */
const answeredFailure = (answer: HttpResponse): VeoError => {
    const status = answer.status
    const { status: word, message } = veoErrorOf(jsonOf(answer.body))
    const params = { status, word, detail: message }
    switch (statusClassOf(status)) {
        case "auth":
            return new VeoError({ code: VeoErrorCode.AuthFailed, params })
        case "rate_limited":
            return new VeoError({ code: VeoErrorCode.RateLimited, params: { ...params, retryAfterSeconds: retryAfterSecondsOf(answer.headers) } })
        case "not_found":
            return new VeoError({ code: VeoErrorCode.NotFound, params })
        case "rejected":
            return new VeoError({ code: VeoErrorCode.Rejected, params })
        case "ok":
        case "server":
        default:
            return new VeoError({ code: VeoErrorCode.Failed, params })
    }
}

const malformed = (what: string): never => {
    throw new VeoError({ code: VeoErrorCode.Malformed, params: { what } })
}

/** The refusal of an argument NIVO will not put on a URL (a model or operation name of another shape): nothing was sent. */
const refusedArgument = (what: string): never => {
    throw new VeoError({ code: VeoErrorCode.Rejected, params: { status: 0, word: "", detail: what } })
}

/**
 * The operation as it stands: `name`, `done`, then `error` (`code`, `message`) or `response`, whose videos are
 * `response.generateVideoResponse.generatedSamples[].video.uri` (the guide's jq path). A done operation with neither videos nor an error
 * is answered with no video (the guide: Veo "will sometimes block a video from generating because of safety filters").
 */
export const veoOperationOf = (body: unknown): VeoOperation => {
    if (!isRecord(body)) return malformed("operation")
    const name = textOf(body.name)
    if (name === null) return malformed("operation name")
    const done = body.done === true
    const error = isRecord(body.error)
        ? {
              code: typeof body.error.code === "number" ? body.error.code : null,
              message: cutDetail(body.error.message) ?? "",
          }
        : null
    const generated = isRecord(body.response) && isRecord(body.response.generateVideoResponse) ? body.response.generateVideoResponse : null
    const samples = generated !== null && Array.isArray(generated.generatedSamples) ? generated.generatedSamples : []
    const videoUris = samples.flatMap((sample: unknown) => {
        const uri = isRecord(sample) && isRecord(sample.video) ? textOf(sample.video.uri) : null
        return uri === null ? [] : [uri]
    })
    return { name, done, error, videoUris: done ? videoUris : [] }
}

@Injectable()
/**
 * The one place that talks to Veo through the Gemini API (https://aistudio.google.com/docs/veo). The API key is always explicit (the key
 * of one connection) and never logged; it is sent only to the API's own origin (a video URI on any other origin is refused before a
 * request leaves). Every failure is a `VeoError` whose code says WHERE it failed.
 */
export class VeoClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectVeoOptions() private readonly options: VeoOptions,
    ) {}

    /**
     * `POST {base}/models/{model}:predictLongRunning` with `{ instances: [{ prompt, image? }], parameters }`: answers the operation
     * (`name`) to poll.
     */
    async generate(apiKey: string, request: VeoGenerateRequest): Promise<VeoOperation> {
        if (!MODEL_ID.test(request.model)) return refusedArgument("model")
        const parameters = {
            ...(request.aspectRatio === null ? {} : { aspectRatio: request.aspectRatio }),
            ...(request.resolution === null ? {} : { resolution: request.resolution }),
            ...(request.durationSeconds === null ? {} : { durationSeconds: request.durationSeconds }),
            ...(request.personGeneration === null ? {} : { personGeneration: request.personGeneration }),
            ...(request.seed === null ? {} : { seed: request.seed }),
        }
        const instance = {
            prompt: request.prompt,
            ...(request.image === null ? {} : { image: { inlineData: { mimeType: request.image.mimeType, data: request.image.data } } }),
        }
        const answer = await this.send({
            method: "POST",
            url: `${this.options.apiBase}/models/${request.model}:predictLongRunning`,
            headers: { [KEY_HEADER]: apiKey },
            body: { instances: [instance], parameters },
            timeoutMs: this.options.timeoutMs,
        })
        return veoOperationOf(answer.body)
    }

    /** `GET {base}/{operation name}`: the operation as it stands. */
    async operation(apiKey: string, name: string): Promise<VeoOperation> {
        if (!OPERATION_NAME.test(name)) return refusedArgument("operation")
        const answer = await this.send({
            method: "GET",
            url: `${this.options.apiBase}/${name}`,
            headers: { [KEY_HEADER]: apiKey },
            timeoutMs: this.options.timeoutMs,
        })
        return veoOperationOf(answer.body)
    }

    /**
     * `GET {video.uri}` with the key, following a redirect (the guide's `curl -L`): the video's bytes. The key goes to the API's own origin
     * only: a URI on another origin is refused before anything leaves, and a redirect is followed once WITHOUT the key (https only).
     */
    async download(apiKey: string, uri: string): Promise<VeoVideo> {
        if (!this.isApiOrigin(uri)) return refusedArgument("video uri")
        const first = await this.send({
            method: "GET",
            url: uri,
            headers: { [KEY_HEADER]: apiKey },
            read: "bytes",
            redirect: "manual",
            timeoutMs: this.options.mediaTimeoutMs,
        })
        const location = REDIRECTS.has(first.status) ? textOf(first.headers?.location) : null
        const answer =
            location === null
                ? first
                : await this.send({
                      method: "GET",
                      url: httpsOf(new URL(location, uri)),
                      read: "bytes",
                      timeoutMs: this.options.mediaTimeoutMs,
                  })
        if (!Buffer.isBuffer(answer.body) || answer.body.length === 0) return malformed("video")
        return { bytes: answer.body, contentType: textOf(answer.headers?.["content-type"]) }
    }

    /** True for an https URI on the API's own origin. */
    private isApiOrigin(uri: string): boolean {
        if (!URL.canParse(uri) || !URL.canParse(this.options.apiBase)) return false
        const target = new URL(uri)
        return target.protocol === "https:" && target.origin === new URL(this.options.apiBase).origin
    }

    /** Sends one request: a transport failure is `Unreachable` (it may have left), an answered failure is typed by its status. */
    private async send(request: HttpRequest): Promise<HttpResponse> {
        const answer = await this.http.request(request).catch((cause: unknown) => {
            throw new VeoError({ code: VeoErrorCode.Unreachable, cause })
        })
        if (statusClassOf(answer.status) !== "ok" && !(request.redirect === "manual" && REDIRECTS.has(answer.status))) {
            throw answeredFailure(answer)
        }
        return answer
    }
}
