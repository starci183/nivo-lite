import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT, HttpError, HttpErrorCode } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import {
    J2V_CREATED,
    J2V_ERROR_BODY,
    J2V_ERROR_CODED,
    J2V_KEY,
    J2V_PROJECT,
    J2V_STATUS_DONE,
    J2V_STATUS_ERROR,
    J2V_STATUS_PENDING,
    J2V_STATUS_RUNNING,
    J2V_URL,
} from "../../../tests/fixtures/builders/json2video.builder"
import { Json2videoErrorCode } from "./errors/json2video.error"
import type { Json2VideoMovie } from "./json2video.contracts"
import { Json2VideoClient, json2videoMovieOf } from "./json2video.client"
import { JSON2VIDEO_OPTIONS } from "./json2video.decorators"
import { JSON2VIDEO_OPERATIONS } from "./json2video.operations"
import type { Json2VideoOptions } from "./json2video.options"

const BASE = "https://api.json2video.com/v2"
const options: Json2VideoOptions = { apiBase: BASE, timeoutMs: 4000 }

const movie: Json2VideoMovie = {
    resolution: "custom",
    width: 720,
    height: 1280,
    scenes: [{ elements: [{ type: "video", src: "https://store.test/c1.mp4", resize: "cover", position: "center-center" }] }],
    elements: [],
}

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [Json2VideoClient, { provide: HTTP_CLIENT, useValue: http }, { provide: JSON2VIDEO_OPTIONS, useValue: options }],
    }).compile()
    return { client: moduleRef.get(Json2VideoClient), http }
}

describe("Json2VideoClient > create (POST /v2/movies)", () => {
    it("posts the movie JSON with the x-api-key header and reads the project", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: J2V_CREATED })

        await expect(client.create(J2V_KEY, movie)).resolves.toEqual({ project: J2V_PROJECT })
        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: `${BASE}/movies`,
            headers: { "x-api-key": J2V_KEY },
            body: movie,
            timeoutMs: 4000,
        })
    })

    it("reads a success without a project as unreadable", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { success: true } })

        await expect(client.create(J2V_KEY, movie)).rejects.toMatchObject({ code: Json2videoErrorCode.Malformed })
    })

    it.each([
        [400, J2V_ERROR_BODY, Json2videoErrorCode.Rejected],
        [401, J2V_ERROR_BODY, Json2videoErrorCode.AuthFailed],
        [403, J2V_ERROR_BODY, Json2videoErrorCode.AuthFailed],
        [404, J2V_ERROR_BODY, Json2videoErrorCode.NotFound],
        [413, J2V_ERROR_CODED, Json2videoErrorCode.Rejected],
        [429, J2V_ERROR_BODY, Json2videoErrorCode.RateLimited],
        [500, J2V_ERROR_BODY, Json2videoErrorCode.Failed],
    ])("types an answered %i as %s with JSON2Video's words", async (status, body, code) => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status, body })

        await expect(client.create(J2V_KEY, movie)).rejects.toMatchObject({
            code,
            params: { status, word: "code" in body ? body.code : "", detail: body.message },
        })
    })

    it("types a transport failure as unreachable", async () => {
        const { client, http } = await build()
        http.request.mockRejectedValue(new HttpError({ code: HttpErrorCode.Network }))

        await expect(client.create(J2V_KEY, movie)).rejects.toMatchObject({ code: Json2videoErrorCode.Unreachable })
    })
})

describe("Json2VideoClient > movie (GET /v2/movies?project=)", () => {
    it.each([
        ["pending", J2V_STATUS_PENDING, { status: "pending", url: null }],
        ["running", J2V_STATUS_RUNNING, { status: "running", url: null }],
        ["done", J2V_STATUS_DONE, { status: "done", url: J2V_URL }],
        ["error", J2V_STATUS_ERROR, { status: "error", url: null, message: "Scene #1, element #2: …" }],
    ])("reads a %s movie", async (_name, body, read) => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body })

        await expect(client.movie(J2V_KEY, J2V_PROJECT)).resolves.toMatchObject({ project: J2V_PROJECT, ...read })
        expect(http.request.mock.calls[0]?.[0]).toMatchObject({
            method: "GET",
            url: `${BASE}/movies?project=${J2V_PROJECT}`,
            headers: { "x-api-key": J2V_KEY },
        })
    })

    it("types the 400 of an unknown project as rejected, with the provider's words", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 400, body: { success: false, message: "Movie x not found." } })

        await expect(client.movie(J2V_KEY, J2V_PROJECT)).rejects.toMatchObject({
            code: Json2videoErrorCode.Rejected,
            params: { status: 400, detail: "Movie x not found." },
        })
    })

    it("refuses a project of another shape before anything leaves", async () => {
        const { client, http } = await build()

        await expect(client.movie(J2V_KEY, "a&b=1")).rejects.toMatchObject({ code: Json2videoErrorCode.Rejected })
        expect(http.request).not.toHaveBeenCalled()
    })

    it.each([
        ["no movie", { success: true }],
        ["no project", { success: true, movie: { status: "done" } }],
        ["a status outside the documented set", { success: true, movie: { project: J2V_PROJECT, status: "weird" } }],
    ])("reads %s as unreadable", (_name, body) => {
        expect(() => json2videoMovieOf(body)).toThrow(Json2videoErrorCode.Malformed)
    })
})

describe("the JSON2Video operations", () => {
    it("names every operation by the API law of its provider, every one built from the docs", () => {
        for (const operation of Object.values(JSON2VIDEO_OPERATIONS)) {
            expect(operation.api.startsWith("nivo.api.json2video.")).toBe(true)
            expect(operation.status).toBe("built")
            expect(operation.docs.startsWith("https://json2video.com/docs/")).toBe(true)
        }
    })
})
