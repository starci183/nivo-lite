import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT, HttpError, HttpErrorCode } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import {
    CREATOMATE_ERROR_400,
    CREATOMATE_ERROR_402,
    CREATOMATE_FAILED,
    CREATOMATE_RENDER_ID,
    CREATOMATE_RENDERING,
    CREATOMATE_STARTED,
    CREATOMATE_SUCCEEDED,
} from "@tests/fixtures/builders/creatomate.builder"
import { CreatomateErrorCode } from "./errors/creatomate.error"
import { CreatomateClient, creatomateRenderOf } from "./creatomate.client"
import type { CreatomateRenderRequest } from "./creatomate.contracts"
import { CREATOMATE_OPTIONS } from "./creatomate.decorators"
import { CREATOMATE_OPERATIONS } from "./creatomate.operations"
import type { CreatomateOptions } from "./creatomate.options"

const BASE = "https://api.creatomate.com"
const options: CreatomateOptions = { apiBase: BASE, timeoutMs: 4000 }
const KEY = ["test", "key"].join("-")

const request: CreatomateRenderRequest = {
    source: {
        output_format: "mp4",
        width: 720,
        height: 1280,
        frame_rate: 30,
        elements: [{ type: "video", track: 1, source: "https://store.test/c1.mp4" }],
    },
    webhookUrl: "https://hooks.test/api/connections/video-render/creatomate/c/s",
}

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [CreatomateClient, { provide: HTTP_CLIENT, useValue: http }, { provide: CREATOMATE_OPTIONS, useValue: options }],
    }).compile()
    return { client: moduleRef.get(CreatomateClient), http }
}

describe("CreatomateClient > start", () => {
    it("posts the RenderScript at the top level with webhook_url and the bearer key, and reads the render", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 202, body: CREATOMATE_STARTED })

        await expect(client.start(KEY, request)).resolves.toEqual({
            id: CREATOMATE_RENDER_ID,
            status: "planned",
            url: CREATOMATE_STARTED.url,
            errorMessage: null,
        })
        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: `${BASE}/v2/renders`,
            headers: { authorization: `Bearer ${KEY}` },
            body: { ...request.source, webhook_url: request.webhookUrl },
            timeoutMs: 4000,
        })
    })

    it("sends no webhook_url without a callback", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 202, body: CREATOMATE_STARTED })

        await client.start(KEY, { ...request, webhookUrl: null })

        expect(http.request.mock.calls[0]?.[0].body).toEqual(request.source)
    })

    it.each([
        [400, CreatomateErrorCode.Rejected, CREATOMATE_ERROR_400],
        [401, CreatomateErrorCode.AuthFailed, CREATOMATE_ERROR_400],
        [402, CreatomateErrorCode.Rejected, CREATOMATE_ERROR_402],
        [404, CreatomateErrorCode.NotFound, CREATOMATE_ERROR_400],
        [429, CreatomateErrorCode.RateLimited, CREATOMATE_ERROR_400],
        [500, CreatomateErrorCode.Failed, {}],
    ])("types an answered %i as %s, with Creatomate's hint", async (status, code, body) => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status, body })

        await expect(client.start(KEY, request)).rejects.toMatchObject({
            code,
            params: { status, detail: "hint" in body ? body.hint : "" },
        })
    })

    it("types a transport failure as unreachable", async () => {
        const { client, http } = await build()
        http.request.mockRejectedValue(new HttpError({ code: HttpErrorCode.Network }))

        await expect(client.start(KEY, request)).rejects.toMatchObject({ code: CreatomateErrorCode.Unreachable })
    })

    it("types an unreadable success as malformed", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 202, body: [CREATOMATE_STARTED] })

        await expect(client.start(KEY, request)).rejects.toMatchObject({ code: CreatomateErrorCode.Malformed })
    })
})

describe("CreatomateClient > render (polled)", () => {
    it.each([
        ["planned", CREATOMATE_STARTED, { status: "planned", url: CREATOMATE_STARTED.url, errorMessage: null }],
        ["rendering", CREATOMATE_RENDERING, { status: "rendering", url: CREATOMATE_STARTED.url, errorMessage: null }],
        ["succeeded", CREATOMATE_SUCCEEDED, { status: "succeeded", url: CREATOMATE_SUCCEEDED.url, errorMessage: null }],
        ["failed", CREATOMATE_FAILED, { status: "failed", url: null, errorMessage: CREATOMATE_FAILED.error_message }],
    ])("reads a %s render", async (_name, body, read) => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body })

        await expect(client.render(KEY, CREATOMATE_RENDER_ID)).resolves.toEqual({ id: CREATOMATE_RENDER_ID, ...read })
        expect(http.request.mock.calls[0]?.[0]).toMatchObject({
            method: "GET",
            url: `${BASE}/v2/renders/${CREATOMATE_RENDER_ID}`,
            headers: { authorization: `Bearer ${KEY}` },
        })
    })

    it("refuses an id of another shape before anything leaves", async () => {
        const { client, http } = await build()

        await expect(client.render(KEY, "../templates")).rejects.toMatchObject({ code: CreatomateErrorCode.Rejected })
        expect(http.request).not.toHaveBeenCalled()
    })

    it("types a 404 as not found", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 404, body: CREATOMATE_ERROR_400 })

        await expect(client.render(KEY, CREATOMATE_RENDER_ID)).rejects.toMatchObject({ code: CreatomateErrorCode.NotFound })
    })
})

describe("creatomateRenderOf", () => {
    it("is null for a body without an id or with a status the docs do not list", () => {
        expect(creatomateRenderOf({ status: "succeeded" })).toBeNull()
        expect(creatomateRenderOf({ id: "x", status: "exploded" })).toBeNull()
        expect(creatomateRenderOf("nope")).toBeNull()
    })
})

describe("the Creatomate operations", () => {
    it("names every operation by the API law of its provider, every one built from the docs", () => {
        for (const operation of Object.values(CREATOMATE_OPERATIONS)) {
            expect(operation.api.startsWith("nivo.api.creatomate.")).toBe(true)
            expect(operation.status).toBe("built")
        }
    })
})
