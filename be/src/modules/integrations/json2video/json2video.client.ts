import { Injectable } from "@nestjs/common"
import { InjectHttpClient, type HttpClient, type HttpRequest, type HttpResponse } from "@modules/platform/http"
import { isRecord } from "@modules/platform/primitives"
import { cutDetail, retryAfterSecondsOf, statusClassOf } from "@modules/integrations/provider-http"
import { Json2videoError, Json2videoErrorCode } from "./errors/json2video.error"
import {
    JSON2VIDEO_STATUSES,
    type Json2VideoMovie,
    type Json2VideoMovieState,
    type Json2VideoStarted,
    type Json2VideoStatus,
} from "./json2video.contracts"
import { InjectJson2VideoOptions } from "./json2video.decorators"
import type { Json2VideoOptions } from "./json2video.options"

/** The header that carries the API key (https://json2video.com/docs/v2/reference/api-endpoints/movies-create: `x-api-key`). */
const KEY_HEADER = "x-api-key"

/** A project id as a query value takes it: the docs name it a 16-character string; NIVO only keeps anything else off the URL. */
const PROJECT_ID = /^[A-Za-z0-9_-]{1,64}$/u

const textOf = (value: unknown): string | null =>
    typeof value === "string" && value.trim() !== "" ? value.trim() : null

/** The code word and the words of a JSON2Video error body, each empty when the body holds none. */
export interface Json2videoErrorBody {
    /** The `code` word. */
    readonly code: string
    /** The `message` words. */
    readonly message: string
}

/**
 * JSON2Video's synchronous error body (https://json2video.com/docs/v2/reference/errors): `{ success: false, message, code? }`; its
 * `code` word (`movie_json_too_large`, `account_suspended`...) and its words.
 */
export const json2videoErrorOf = (body: unknown): Json2videoErrorBody => {
    const record = isRecord(body) ? body : null
    return { code: textOf(record?.code) ?? "", message: cutDetail(record?.message) ?? "" }
}

/** The typed failure of an answered status that is no success: by the status' class alone. */
const answeredFailure = (answer: HttpResponse): Json2videoError => {
    const status = answer.status
    const { code, message } = json2videoErrorOf(answer.body)
    const params = { status, word: code, detail: message }
    switch (statusClassOf(status)) {
        case "auth":
            return new Json2videoError({ code: Json2videoErrorCode.AuthFailed, params })
        case "rate_limited":
            return new Json2videoError({
                code: Json2videoErrorCode.RateLimited,
                params: { ...params, retryAfterSeconds: retryAfterSecondsOf(answer.headers) },
            })
        case "not_found":
            return new Json2videoError({ code: Json2videoErrorCode.NotFound, params })
        case "rejected":
            return new Json2videoError({ code: Json2videoErrorCode.Rejected, params })
        case "ok":
        case "server":
            return new Json2videoError({ code: Json2videoErrorCode.Failed, params })
    }
}

const malformed = (what: string): never => {
    throw new Json2videoError({ code: Json2videoErrorCode.Malformed, params: { what } })
}

/** The refusal of an argument NIVO will not put on a URL: nothing was sent. */
const refusedArgument = (what: string): never => {
    throw new Json2videoError({ code: Json2videoErrorCode.Rejected, params: { status: 0, word: "", detail: what } })
}

const isStatus = (value: unknown): value is Json2VideoStatus => {
    const statuses: ReadonlyArray<unknown> = JSON2VIDEO_STATUSES
    return statuses.includes(value)
}

/** The answer of `POST /v2/movies`: `{ success: true, project, timestamp }`. */
export const json2videoStartedOf = (body: unknown): Json2VideoStarted => {
    if (!isRecord(body) || body.success !== true) return malformed("create answer")
    const project = textOf(body.project)
    return project === null ? malformed("project") : { project }
}

/**
 * The answer of `GET /v2/movies?project=`: `{ success, movie: { success, status, message, project, url, created_at, ... } }`
 * (https://json2video.com/docs/v2/reference/api-endpoints/movies-status). The video address is `movie.url`. A status word outside the
 * documented set is unreadable.
 */
export const json2videoMovieOf = (body: unknown): Json2VideoMovieState => {
    const movie = isRecord(body) ? body.movie : undefined
    if (!isRecord(movie)) return malformed("movie")
    const project = textOf(movie.project)
    if (project === null) return malformed("movie project")
    if (!isStatus(movie.status)) return malformed("movie status")
    return {
        project,
        status: movie.status,
        message: cutDetail(movie.message) ?? "",
        url: textOf(movie.url),
        createdAt: textOf(movie.created_at),
    }
}

@Injectable()
/**
 * The one place that talks to JSON2Video (https://json2video.com/docs/v2). The API key is always explicit (the key of one connection),
 * sent in the header `x-api-key` and never logged. Every failure is a `Json2videoError` whose code says WHERE it failed.
 */
export class Json2VideoClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectJson2VideoOptions() private readonly options: Json2VideoOptions,
    ) {}

    /** `POST {base}/movies` with the movie JSON (https://json2video.com/docs/v2/reference/api-endpoints/movies-create): answers the project. */
    async create(apiKey: string, movie: Json2VideoMovie): Promise<Json2VideoStarted> {
        const answer = await this.send({
            method: "POST",
            url: `${this.options.apiBase}/movies`,
            headers: { [KEY_HEADER]: apiKey },
            body: movie,
            timeoutMs: this.options.timeoutMs,
        })
        return json2videoStartedOf(answer.body)
    }

    /** `GET {base}/movies?project={project}` (https://json2video.com/docs/v2/reference/api-endpoints/movies-status): the movie as it stands. */
    async movie(apiKey: string, project: string): Promise<Json2VideoMovieState> {
        if (!PROJECT_ID.test(project)) return refusedArgument("project")
        const answer = await this.send({
            method: "GET",
            url: `${this.options.apiBase}/movies?project=${encodeURIComponent(project)}`,
            headers: { [KEY_HEADER]: apiKey },
            timeoutMs: this.options.timeoutMs,
        })
        return json2videoMovieOf(answer.body)
    }

    /** Sends one request: a transport failure is `Unreachable` (it may have left), an answered failure is typed by its status. */
    private async send(request: HttpRequest): Promise<HttpResponse> {
        const answer = await this.http.request(request).catch((cause: unknown) => {
            throw new Json2videoError({ code: Json2videoErrorCode.Unreachable, cause })
        })
        if (statusClassOf(answer.status) !== "ok") throw answeredFailure(answer)
        return answer
    }
}
