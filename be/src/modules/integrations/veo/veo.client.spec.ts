import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT, HttpError, HttpErrorCode } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { VeoErrorCode } from "./errors/veo.error"
import { VeoClient, veoOperationOf } from "./veo.client"
import { VEO_OPTIONS } from "./veo.decorators"
import { VEO_OPERATIONS } from "./veo.operations"
import type { VeoGenerateRequest } from "./veo.contracts"
import type { VeoOptions } from "./veo.options"

const BASE = "https://generativelanguage.googleapis.com/v1beta"
const options: VeoOptions = { apiBase: BASE, timeoutMs: 4000, mediaTimeoutMs: 9000 }
const KEY = ["test", "key"].join("-")
const OPERATION = "models/veo-3.1-generate-preview/operations/abc123"
const VIDEO_URI = `${BASE}/files/xyz:download?alt=media`

/** A started operation: the guide reads its `name` (https://aistudio.google.com/docs/veo, REST example). */
const STARTED = { name: OPERATION }

/** A finished operation: the guide reads `.response.generateVideoResponse.generatedSamples[0].video.uri`. */
const DONE = { name: OPERATION, done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: VIDEO_URI } }] } } }

/** A failed operation: `done` with `error` (`code`, `message`), the long-running operation resource. */
const FAILED = { name: OPERATION, done: true, error: { code: 3, message: "The prompt was refused." } }

/** Google's error body (https://aistudio.google.com/docs/api-errors.md). */
const INVALID = { error: { code: 400, message: "The request body is malformed.", status: "INVALID_ARGUMENT", details: [] } }

const request: VeoGenerateRequest = {
    model: "veo-3.1-generate-preview",
    prompt: "A lotus pond at dawn",
    image: null,
    aspectRatio: null,
    resolution: null,
    durationSeconds: null,
    personGeneration: null,
    seed: null,
}

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [VeoClient, { provide: HTTP_CLIENT, useValue: http }, { provide: VEO_OPTIONS, useValue: options }],
    }).compile()
    return { client: moduleRef.get(VeoClient), http }
}

describe("VeoClient > generate (predictLongRunning)", () => {
    it("posts the prompt and the given parameters to the model, with the key header, and reads the operation name", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: STARTED })

        const operation = await client.generate(KEY, {
            ...request,
            image: { mimeType: "image/png", data: "aGVsbG8=" },
            aspectRatio: "9:16",
            resolution: "720p",
            durationSeconds: "8",
            personGeneration: "allow_adult",
            seed: 5,
        })

        expect(operation).toEqual({ name: OPERATION, done: false, error: null, videoUris: [] })
        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: `${BASE}/models/veo-3.1-generate-preview:predictLongRunning`,
            headers: { "x-goog-api-key": KEY },
            body: {
                instances: [{ prompt: "A lotus pond at dawn", image: { inlineData: { mimeType: "image/png", data: "aGVsbG8=" } } }],
                parameters: { aspectRatio: "9:16", resolution: "720p", durationSeconds: "8", personGeneration: "allow_adult", seed: 5 },
            },
            timeoutMs: 4000,
        })
    })

    it("sends no parameter it was not given", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: STARTED })

        await client.generate(KEY, request)

        expect(http.request.mock.calls[0]?.[0].body).toEqual({ instances: [{ prompt: "A lotus pond at dawn" }], parameters: {} })
    })

    it("refuses a model id of another shape before anything leaves", async () => {
        const { client, http } = await build()

        await expect(client.generate(KEY, { ...request, model: "../files" })).rejects.toMatchObject({ code: VeoErrorCode.Rejected })
        expect(http.request).not.toHaveBeenCalled()
    })

    it.each([
        [400, VeoErrorCode.Rejected],
        [402, VeoErrorCode.Rejected],
        [403, VeoErrorCode.AuthFailed],
        [404, VeoErrorCode.NotFound],
        [429, VeoErrorCode.RateLimited],
        [500, VeoErrorCode.Failed],
        [504, VeoErrorCode.Failed],
    ])("types an answered %i as %s, with Google's status word", async (status, code) => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status, body: INVALID })

        await expect(client.generate(KEY, request)).rejects.toMatchObject({ code, params: { status, word: "INVALID_ARGUMENT" } })
    })

    it("types a transport failure as unreachable", async () => {
        const { client, http } = await build()
        http.request.mockRejectedValue(new HttpError({ code: HttpErrorCode.Network }))

        await expect(client.generate(KEY, request)).rejects.toMatchObject({ code: VeoErrorCode.Unreachable })
    })
})

describe("VeoClient > the operation, polled (pending, done, failed)", () => {
    it.each([
        ["pending", { name: OPERATION, done: false }, { done: false, error: null, videoUris: [] }],
        ["done", DONE, { done: true, error: null, videoUris: [VIDEO_URI] }],
        ["failed", FAILED, { done: true, error: { code: 3, message: "The prompt was refused." }, videoUris: [] }],
        ["done with no video (filtered)", { name: OPERATION, done: true, response: { generateVideoResponse: {} } }, { done: true, error: null, videoUris: [] }],
    ])("reads a %s operation", async (_name, body, read) => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body })

        await expect(client.operation(KEY, OPERATION)).resolves.toEqual({ name: OPERATION, ...read })
        expect(http.request.mock.calls[0]?.[0]).toMatchObject({ method: "GET", url: `${BASE}/${OPERATION}`, headers: { "x-goog-api-key": KEY } })
    })

    it("refuses an operation name of another shape before anything leaves", async () => {
        const { client, http } = await build()

        await expect(client.operation(KEY, "https://evil.test/x")).rejects.toMatchObject({ code: VeoErrorCode.Rejected })
        await expect(client.operation(KEY, "a?key=1")).rejects.toMatchObject({ code: VeoErrorCode.Rejected })
        expect(http.request).not.toHaveBeenCalled()
    })

    it("refuses an operation without a name as unreadable", () => {
        const thrown = (() => {
            try {
                return veoOperationOf({ done: true })
            } catch (error) {
                return error
            }
        })()

        expect(thrown).toMatchObject({ code: VeoErrorCode.Malformed })
    })
})

describe("VeoClient > download", () => {
    it("reads the video bytes with the key, on the API's own origin", async () => {
        const { client, http } = await build()
        const bytes = Buffer.from("fake-mp4")
        http.request.mockResolvedValue({ status: 200, headers: { "content-type": "video/mp4" }, body: bytes })

        await expect(client.download(KEY, VIDEO_URI)).resolves.toEqual({ bytes, contentType: "video/mp4" })
        expect(http.request.mock.calls[0]?.[0]).toMatchObject({ url: VIDEO_URI, headers: { "x-goog-api-key": KEY }, redirect: "manual" })
    })

    it("follows one redirect WITHOUT the key", async () => {
        const { client, http } = await build()
        const bytes = Buffer.from("fake-mp4")
        http.request
            .mockResolvedValueOnce({ status: 302, headers: { location: "https://video-storage.test/v.mp4" }, body: Buffer.alloc(0) })
            .mockResolvedValueOnce({ status: 200, body: bytes })

        await expect(client.download(KEY, VIDEO_URI)).resolves.toMatchObject({ bytes })
        const second = http.request.mock.calls[1]?.[0]
        expect(second?.url).toBe("https://video-storage.test/v.mp4")
        expect(second?.headers).toBeUndefined()
    })

    it("never sends the key to another origin", async () => {
        const { client, http } = await build()

        await expect(client.download(KEY, "https://evil.test/v.mp4")).rejects.toMatchObject({ code: VeoErrorCode.Rejected })
        expect(http.request).not.toHaveBeenCalled()
    })
})

describe("the Veo operations", () => {
    it("names every operation by the API law of its provider, every one built from the guide", () => {
        for (const operation of Object.values(VEO_OPERATIONS)) {
            expect(operation.api.startsWith("nivo.api.veo.")).toBe(true)
            expect(operation.status).toBe("built")
        }
    })
})
