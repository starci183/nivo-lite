import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT, HttpError, HttpErrorCode } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { ElevenlabsError, ElevenlabsErrorCode } from "./errors/elevenlabs.error"
import { ElevenLabsClient, elevenLabsDetailOf } from "./elevenlabs.client"
import { ELEVENLABS_OPTIONS } from "./elevenlabs.decorators"
import { ELEVENLABS_OPERATIONS } from "./elevenlabs.operations"
import type { ElevenLabsOptions } from "./elevenlabs.options"

const options: ElevenLabsOptions = { apiBase: "https://elevenlabs.test", timeoutMs: 4000, mediaTimeoutMs: 9000 }
const KEY = ["test", "key"].join("-")
const AUDIO = Buffer.from("ID3-fake-mp3-bytes")

/** The create answer of the dubbing reference (https://elevenlabs.io/docs/api-reference/dubbing/create, example response). */
const DUBBING_CREATED = { dubbing_id: "21m00Tcm4TlvDq8ikWAM", expected_duration_sec: 127.5 }

/** The get answer of the dubbing reference (https://elevenlabs.io/docs/api-reference/dubbing/get, example response). */
const DUBBING = {
    dubbing_id: "21m00Tcm4TlvDq8ikWAM",
    name: "My Dubbing Project",
    status: "dubbed",
    source_language: "en",
    target_languages: ["es", "fr", "de"],
    created_at: "2025-07-15T14:49:41.149000",
    editable: true,
    media_metadata: { content_type: "video/mp4", duration: 127.5 },
}

/** A voice search answer with the members of the reference (https://elevenlabs.io/docs/api-reference/voices/search). */
const VOICES = {
    voices: [
        {
            voice_id: "21m00Tcm4TlvDq8ikWAM",
            name: "Rachel",
            category: "premade",
            labels: { accent: "american", gender: "female" },
            preview_url: "https://storage.test/rachel.mp3",
        },
    ],
    has_more: true,
    total_count: 1,
    next_page_token: "string",
}

/** The 422 of every reference: `detail` is a list of `{ loc, msg, type }`. */
const VALIDATION = { detail: [{ loc: ["body", "text"], msg: "field required", type: "value_error.missing" }] }

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [ElevenLabsClient, { provide: HTTP_CLIENT, useValue: http }, { provide: ELEVENLABS_OPTIONS, useValue: options }],
    }).compile()
    return { client: moduleRef.get(ElevenLabsClient), http }
}

const speech = {
    voiceId: "21m00Tcm4TlvDq8ikWAM",
    text: "Xin ch\u00E0o",
    modelId: null,
    languageCode: null,
    seed: null,
    outputFormat: null,
}

describe("ElevenLabsClient > text-to-speech convert", () => {
    it("posts the text to the voice's path with the key header and reads the audio bytes", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, headers: { "content-type": "audio/mpeg" }, body: AUDIO })

        const audio = await client.convert(KEY, { ...speech, modelId: "eleven_multilingual_v2", seed: 7, outputFormat: "mp3_44100_128" })

        expect(audio).toEqual({ bytes: AUDIO, contentType: "audio/mpeg" })
        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: "https://elevenlabs.test/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM?output_format=mp3_44100_128",
            headers: { "xi-api-key": KEY },
            body: { text: "Xin ch\u00E0o", model_id: "eleven_multilingual_v2", seed: 7 },
            read: "bytes",
            timeoutMs: 9000,
        })
    })

    it("sends no optional member it was not given, and no query", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: AUDIO })

        await client.convert(KEY, { ...speech, languageCode: "vi" })

        expect(http.request.mock.calls[0]?.[0]).toMatchObject({
            url: "https://elevenlabs.test/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
            body: { text: "Xin ch\u00E0o", language_code: "vi" },
        })
    })

    it("refuses an empty audio answer as unreadable", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: Buffer.alloc(0) })

        await expect(client.convert(KEY, speech)).rejects.toMatchObject({ code: ElevenlabsErrorCode.Malformed })
    })

    it("reads the validation words of a 422 answered as bytes", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 422, body: Buffer.from(JSON.stringify(VALIDATION)) })

        await expect(client.convert(KEY, speech)).rejects.toMatchObject({
            code: ElevenlabsErrorCode.Rejected,
            params: { status: 422, detail: "field required" },
        })
    })
})

describe("ElevenLabsClient > the typed failures, by where they fail", () => {
    it.each([
        [401, ElevenlabsErrorCode.AuthFailed],
        [403, ElevenlabsErrorCode.AuthFailed],
        [404, ElevenlabsErrorCode.NotFound],
        [400, ElevenlabsErrorCode.Rejected],
        [422, ElevenlabsErrorCode.Rejected],
        [429, ElevenlabsErrorCode.RateLimited],
        [500, ElevenlabsErrorCode.Failed],
        [503, ElevenlabsErrorCode.Failed],
    ])("types an answered %i as %s", async (status, code) => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status, headers: { "retry-after": "3" }, body: VALIDATION })

        await expect(client.getDubbing(KEY, "d-1")).rejects.toMatchObject({ code })
    })

    it("carries the seconds a 429 asked to wait", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 429, headers: { "retry-after": "3" }, body: undefined })

        await expect(client.searchVoices(KEY, { search: null, pageSize: 10, nextPageToken: null })).rejects.toMatchObject({
            params: { retryAfterSeconds: 3 },
        })
    })

    it("types a transport failure as unreachable (the request may have left)", async () => {
        const { client, http } = await build()
        http.request.mockRejectedValue(new HttpError({ code: HttpErrorCode.Timeout }))

        const failure: unknown = await client.createDubbing(KEY, { sourceUrl: "https://a.test/v.mp4", targetLang: "vi", sourceLang: null, name: null, numSpeakers: null, watermark: null }).catch((cause: unknown) => cause)

        expect(failure).toBeInstanceOf(ElevenlabsError)
        expect(failure).toMatchObject({ code: ElevenlabsErrorCode.Unreachable })
    })
})

describe("ElevenLabsClient > voices search", () => {
    it("asks a page with the documented query members and reads each voice", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: VOICES })

        const page = await client.searchVoices(KEY, { search: "rachel", pageSize: 25, nextPageToken: "p-2" })

        expect(http.request.mock.calls[0]?.[0]).toMatchObject({
            method: "GET",
            url: "https://elevenlabs.test/v2/voices?page_size=25&search=rachel&next_page_token=p-2",
            headers: { "xi-api-key": KEY },
        })
        expect(page).toEqual({
            voices: [
                {
                    voiceId: "21m00Tcm4TlvDq8ikWAM",
                    name: "Rachel",
                    category: "premade",
                    labels: { accent: "american", gender: "female" },
                    previewUrl: "https://storage.test/rachel.mp3",
                },
            ],
            hasMore: true,
            nextPageToken: "string",
        })
    })

    it("refuses a voice without its id, never skips it", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { voices: [{ name: "x" }], has_more: false } })

        await expect(client.searchVoices(KEY, { search: null, pageSize: 10, nextPageToken: null })).rejects.toMatchObject({
            code: ElevenlabsErrorCode.Malformed,
        })
    })
})

describe("ElevenLabsClient > dubbing (create, then poll, then the file)", () => {
    it("posts the documented form fields as multipart/form-data and reads the job", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: DUBBING_CREATED })

        const started = await client.createDubbing(KEY, {
            sourceUrl: "https://media.test/clip.mp4",
            targetLang: "vi",
            sourceLang: "en",
            name: "Clip",
            numSpeakers: 0,
            watermark: true,
        })

        expect(started).toEqual({ dubbingId: "21m00Tcm4TlvDq8ikWAM", expectedDurationSec: 127.5 })
        const sent = http.request.mock.calls[0]?.[0]
        expect(sent).toMatchObject({ method: "POST", url: "https://elevenlabs.test/v1/dubbing" })
        expect(sent?.headers?.["content-type"]).toMatch(/^multipart\/form-data; boundary=/u)
        const form = sent?.bytes?.toString("utf8") ?? ""
        for (const [name, value] of [
            ["source_url", "https://media.test/clip.mp4"],
            ["target_lang", "vi"],
            ["source_lang", "en"],
            ["name", "Clip"],
            ["num_speakers", "0"],
            ["watermark", "true"],
        ]) {
            expect(form).toContain(`Content-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)
        }
    })

    it("reads a job as it stands", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: DUBBING })

        await expect(client.getDubbing(KEY, "21m00Tcm4TlvDq8ikWAM")).resolves.toEqual({
            dubbingId: "21m00Tcm4TlvDq8ikWAM",
            name: "My Dubbing Project",
            status: "dubbed",
            targetLanguages: ["es", "fr", "de"],
            error: null,
        })
        expect(http.request.mock.calls[0]?.[0].url).toBe("https://elevenlabs.test/v1/dubbing/21m00Tcm4TlvDq8ikWAM")
    })

    it("reads the failure words of a failed job", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { ...DUBBING, status: "failed", error: "Source could not be read" } })

        await expect(client.getDubbing(KEY, "d")).resolves.toMatchObject({ error: "Source could not be read" })
    })

    it("downloads the dubbed file of one language as bytes", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, headers: { "content-type": "video/mp4" }, body: AUDIO })

        await expect(client.dubbedFile(KEY, "21m00Tcm4TlvDq8ikWAM", "es")).resolves.toEqual({ bytes: AUDIO, contentType: "video/mp4" })
        expect(http.request.mock.calls[0]?.[0]).toMatchObject({
            url: "https://elevenlabs.test/v1/dubbing/21m00Tcm4TlvDq8ikWAM/audio/es",
            read: "bytes",
        })
    })
})

describe("the ElevenLabs operations", () => {
    it("names every operation by the API law of its provider, every one built from its reference", () => {
        for (const operation of Object.values(ELEVENLABS_OPERATIONS)) {
            expect(operation.api.startsWith("nivo.api.elevenlabs.")).toBe(true)
            expect(operation.status).toBe("built")
            expect(operation.docs.startsWith("https://elevenlabs.io/docs/api-reference/")).toBe(true)
        }
    })

    it("reads the words of a refusal, whatever its documented shape", () => {
        expect(elevenLabsDetailOf(VALIDATION)).toBe("field required")
        expect(elevenLabsDetailOf({ detail: { message: "quota" } })).toBe("quota")
        expect(elevenLabsDetailOf({ detail: "nope" })).toBe("nope")
        expect(elevenLabsDetailOf(undefined)).toBeNull()
    })
})
