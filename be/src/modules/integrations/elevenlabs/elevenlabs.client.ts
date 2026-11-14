import { Injectable } from "@nestjs/common"
import { InjectHttpClient, type HttpClient, type HttpRequest, type HttpResponse } from "@modules/platform/http"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { cutDetail, multipartOf, retryAfterSecondsOf, statusClassOf, type MultipartField } from "@modules/integrations/provider-http"
import { ElevenlabsError, ElevenlabsErrorCode } from "./errors/elevenlabs.error"
import type {
    ElevenLabsAudio,
    ElevenLabsDubbing,
    ElevenLabsDubbingRequest,
    ElevenLabsDubbingStarted,
    ElevenLabsSpeechRequest,
    ElevenLabsVoice,
    ElevenLabsVoicePage,
    ElevenLabsVoiceSearch,
} from "./elevenlabs.contracts"
import { InjectElevenLabsOptions } from "./elevenlabs.decorators"
import type { ElevenLabsOptions } from "./elevenlabs.options"

/** The header that carries the API key (https://elevenlabs.io/docs/api-reference/authentication). */
const KEY_HEADER = "xi-api-key"

const textOf = (value: unknown): string | null =>
    typeof value === "string" && value.trim() !== "" ? value.trim() : null

/**
 * ElevenLabs' own words on a refusal: a validation error's `detail` is a list of `{ loc, msg, type }` (the 422 of every operation's
 * reference), else a text `detail` or `detail.message`. Null when it said nothing readable.
 */
export const elevenLabsDetailOf = (body: unknown): string | null => {
    if (!isRecord(body)) return cutDetail(body)
    const { detail } = body
    if (Array.isArray(detail)) {
        const words = detail.flatMap((item: unknown) => (isRecord(item) && typeof item.msg === "string" ? [item.msg] : []))
        return cutDetail(words.join("; "))
    }
    if (isRecord(detail)) return cutDetail(detail.message)
    return cutDetail(detail)
}

/** A body read as bytes (an audio call that failed answers JSON): parsed when it is JSON, else as it is. */
const jsonOf = (body: unknown): unknown => {
    if (!Buffer.isBuffer(body)) return body
    const read = parseJsonText(body.toString("utf8"))
    return read.ok ? read.value : null
}

/** The typed failure of an answered status that is no success: by the status' class alone. */
const answeredFailure = (answer: HttpResponse): ElevenlabsError => {
    const status = answer.status
    const detail = elevenLabsDetailOf(jsonOf(answer.body)) ?? ""
    switch (statusClassOf(status)) {
        case "auth":
            return new ElevenlabsError({ code: ElevenlabsErrorCode.AuthFailed, params: { status, detail } })
        case "rate_limited":
            return new ElevenlabsError({
                code: ElevenlabsErrorCode.RateLimited,
                params: { status, retryAfterSeconds: retryAfterSecondsOf(answer.headers) },
            })
        case "not_found":
            return new ElevenlabsError({ code: ElevenlabsErrorCode.NotFound, params: { status, detail } })
        case "rejected":
            return new ElevenlabsError({ code: ElevenlabsErrorCode.Rejected, params: { status, detail } })
        case "ok":
        case "server":
        default:
            return new ElevenlabsError({ code: ElevenlabsErrorCode.Failed, params: { status, detail } })
    }
}

const malformed = (what: string): never => {
    throw new ElevenlabsError({ code: ElevenlabsErrorCode.Malformed, params: { what } })
}

/** One voice of a search answer (`voices[]`); a voice without its id is unreadable, never skipped. */
const voiceOf = (row: unknown): ElevenLabsVoice => {
    if (!isRecord(row)) return malformed("voice")
    const voiceId = textOf(row.voice_id)
    if (voiceId === null) return malformed("voice_id")
    const labels = isRecord(row.labels)
        ? Object.fromEntries(Object.entries(row.labels).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
        : {}
    return {
        voiceId,
        name: textOf(row.name) ?? voiceId,
        category: textOf(row.category),
        labels,
        previewUrl: textOf(row.preview_url),
    }
}

/** The text form of a boolean form field. */
const flag = (value: boolean): string => (value ? "true" : "false")

@Injectable()
/**
 * The one place that talks to the ElevenLabs API (https://elevenlabs.io/docs/api-reference). The API key is always explicit (the key of
 * one connection) and never logged. Every failure is an `ElevenlabsError` whose code says WHERE it failed (`Unreachable`: the request
 * may have left; an answered status; `Malformed`: it answered success unreadably).
 */
export class ElevenLabsClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectElevenLabsOptions() private readonly options: ElevenLabsOptions,
    ) {}

    /**
     * `POST /v1/text-to-speech/{voice_id}` (https://elevenlabs.io/docs/api-reference/text-to-speech/convert): JSON body `text`
     * (required), `model_id`, `language_code`, `seed`; query `output_format`. Answers the audio file (200).
     */
    async convert(apiKey: string, request: ElevenLabsSpeechRequest): Promise<ElevenLabsAudio> {
        const query = request.outputFormat === null ? "" : `?${new URLSearchParams({ output_format: request.outputFormat }).toString()}`
        const answer = await this.send({
            method: "POST",
            url: `${this.options.apiBase}/v1/text-to-speech/${encodeURIComponent(request.voiceId)}${query}`,
            headers: { [KEY_HEADER]: apiKey },
            body: {
                text: request.text,
                ...(request.modelId === null ? {} : { model_id: request.modelId }),
                ...(request.languageCode === null ? {} : { language_code: request.languageCode }),
                ...(request.seed === null ? {} : { seed: request.seed }),
            },
            read: "bytes",
            timeoutMs: this.options.mediaTimeoutMs,
        })
        return this.audioOf(answer, "audio")
    }

    /**
     * `GET /v2/voices` (https://elevenlabs.io/docs/api-reference/voices/search): query `page_size` (at most 100), `next_page_token`,
     * `search`. Answers `voices[]` (`voice_id`, `name`, `category`, `labels`, `preview_url`), `has_more`, `next_page_token`.
     */
    async searchVoices(apiKey: string, search: ElevenLabsVoiceSearch): Promise<ElevenLabsVoicePage> {
        const query = new URLSearchParams({ page_size: String(search.pageSize) })
        if (search.search !== null) query.set("search", search.search)
        if (search.nextPageToken !== null) query.set("next_page_token", search.nextPageToken)
        const answer = await this.send({
            method: "GET",
            url: `${this.options.apiBase}/v2/voices?${query.toString()}`,
            headers: { [KEY_HEADER]: apiKey },
            timeoutMs: this.options.timeoutMs,
        })
        const body = answer.body
        if (!isRecord(body) || !Array.isArray(body.voices)) return malformed("voices")
        return {
            voices: body.voices.map((row: unknown) => voiceOf(row)),
            hasMore: body.has_more === true,
            nextPageToken: textOf(body.next_page_token),
        }
    }

    /**
     * `POST /v1/dubbing` (https://elevenlabs.io/docs/api-reference/dubbing/create), `multipart/form-data`: `source_url`, `target_lang`
     * (required), `source_lang`, `name`, `num_speakers`, `watermark`. Answers `dubbing_id`, `expected_duration_sec`.
     */
    async createDubbing(apiKey: string, request: ElevenLabsDubbingRequest): Promise<ElevenLabsDubbingStarted> {
        const fields: Array<MultipartField> = [
            { name: "source_url", value: request.sourceUrl },
            { name: "target_lang", value: request.targetLang },
        ]
        if (request.sourceLang !== null) fields.push({ name: "source_lang", value: request.sourceLang })
        if (request.name !== null) fields.push({ name: "name", value: request.name })
        if (request.numSpeakers !== null) fields.push({ name: "num_speakers", value: String(request.numSpeakers) })
        if (request.watermark !== null) fields.push({ name: "watermark", value: flag(request.watermark) })
        const form = multipartOf(fields)
        const answer = await this.send({
            method: "POST",
            url: `${this.options.apiBase}/v1/dubbing`,
            headers: { [KEY_HEADER]: apiKey, "content-type": form.contentType },
            bytes: form.bytes,
            timeoutMs: this.options.timeoutMs,
        })
        const body = answer.body
        const dubbingId = isRecord(body) ? textOf(body.dubbing_id) : null
        if (!isRecord(body) || dubbingId === null) return malformed("dubbing_id")
        const expected = Number(body.expected_duration_sec)
        return { dubbingId, expectedDurationSec: Number.isFinite(expected) && expected >= 0 ? expected : 0 }
    }

    /**
     * `GET /v1/dubbing/{dubbing_id}` (https://elevenlabs.io/docs/api-reference/dubbing/get): answers `dubbing_id`, `name`, `status`,
     * `target_languages`, `error` (null unless the dub failed).
     */
    async getDubbing(apiKey: string, dubbingId: string): Promise<ElevenLabsDubbing> {
        const answer = await this.send({
            method: "GET",
            url: `${this.options.apiBase}/v1/dubbing/${encodeURIComponent(dubbingId)}`,
            headers: { [KEY_HEADER]: apiKey },
            timeoutMs: this.options.timeoutMs,
        })
        const body = answer.body
        if (!isRecord(body)) return malformed("dubbing")
        const id = textOf(body.dubbing_id)
        const status = textOf(body.status)
        if (id === null || status === null) return malformed("dubbing")
        const languages = Array.isArray(body.target_languages)
            ? body.target_languages.filter((language: unknown): language is string => typeof language === "string")
            : []
        return { dubbingId: id, name: textOf(body.name) ?? "", status, targetLanguages: languages, error: textOf(body.error) }
    }

    /**
     * `GET /v1/dubbing/{dubbing_id}/audio/{language_code}` (https://elevenlabs.io/docs/api-reference/dubbing/audio/get): "the dubbed
     * file as a streamed MP3 or MP4 file" of one language (the original automatic dub; an edited one needs the render endpoint).
     */
    async dubbedFile(apiKey: string, dubbingId: string, languageCode: string): Promise<ElevenLabsAudio> {
        const answer = await this.send({
            method: "GET",
            url: `${this.options.apiBase}/v1/dubbing/${encodeURIComponent(dubbingId)}/audio/${encodeURIComponent(languageCode)}`,
            headers: { [KEY_HEADER]: apiKey },
            read: "bytes",
            timeoutMs: this.options.mediaTimeoutMs,
        })
        return this.audioOf(answer, "dubbed file")
    }

    /** Sends one request: a transport failure is `Unreachable` (it may have left), an answered failure is typed by its status. */
    private async send(request: HttpRequest): Promise<HttpResponse> {
        const answer = await this.http.request(request).catch((cause: unknown) => {
            throw new ElevenlabsError({ code: ElevenlabsErrorCode.Unreachable, cause })
        })
        if (statusClassOf(answer.status) !== "ok") throw answeredFailure(answer)
        return answer
    }

    private audioOf(answer: HttpResponse, what: string): ElevenLabsAudio {
        if (!Buffer.isBuffer(answer.body) || answer.body.length === 0) return malformed(what)
        return { bytes: answer.body, contentType: textOf(answer.headers?.["content-type"]) }
    }
}
