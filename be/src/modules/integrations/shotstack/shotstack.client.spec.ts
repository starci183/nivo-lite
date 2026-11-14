import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT, HttpError, HttpErrorCode } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { SHOTSTACK_QUEUED, SHOTSTACK_RENDER_ID, shotstackStatusBody } from "@tests/fixtures/builders/shotstack.builder"
import { ShotstackErrorCode } from "./errors/shotstack.error"
import type { ShotstackEdit } from "./shotstack.contracts"
import { ShotstackClient, shotstackErrorOf, shotstackRenderOf } from "./shotstack.client"
import { SHOTSTACK_OPTIONS } from "./shotstack.decorators"
import { SHOTSTACK_OPERATIONS } from "./shotstack.operations"
import type { ShotstackOptions } from "./shotstack.options"

const BASE = "https://api.shotstack.io/edit"
const options: ShotstackOptions = { apiBase: BASE, timeoutMs: 4000 }
const KEY = ["test", "key"].join("-")
/** The documented Edit (a video clip with `trim`, `start`, `length`), completed with the `output` members the contract requires. */
const EDIT: ShotstackEdit = {
    timeline: {
        tracks: [{ clips: [{ asset: { type: "video", src: "https://example.test/video.mp4", trim: 2 }, start: 4, length: 6 }] }],
    },
    output: { format: "mp4", resolution: "hd", aspectRatio: "16:9" },
}

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [ShotstackClient, { provide: HTTP_CLIENT, useValue: http }, { provide: SHOTSTACK_OPTIONS, useValue: options }],
    }).compile()
    return { client: moduleRef.get(ShotstackClient), http }
}

const failure = (work: Promise<unknown>): Promise<unknown> => Promise.resolve(work.then(() => undefined, (cause: unknown) => cause))

describe("ShotstackClient > render", () => {
    it("posts the Edit to the environment's render path with the key header and reads the render id", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 201, body: SHOTSTACK_QUEUED })

        await expect(client.render(KEY, "stage", EDIT)).resolves.toEqual({ id: SHOTSTACK_RENDER_ID })
        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: `${BASE}/stage/render`,
            headers: { "x-api-key": KEY },
            body: EDIT,
            timeoutMs: 4000,
        })
    })

    it("uses the production segment for v1", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 201, body: SHOTSTACK_QUEUED })

        await client.render(KEY, "v1", EDIT)

        expect(http.request.mock.calls[0]?.[0].url).toBe(`${BASE}/v1/render`)
    })

    it("reads a success with no render id as malformed", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 201, body: { success: true, message: "Created", response: {} } })

        expect(await failure(client.render(KEY, "stage", EDIT))).toMatchObject({ code: ShotstackErrorCode.Malformed })
    })

    it.each([
        [401, ShotstackErrorCode.AuthFailed],
        [403, ShotstackErrorCode.AuthFailed],
        [404, ShotstackErrorCode.NotFound],
        [400, ShotstackErrorCode.Rejected],
        [429, ShotstackErrorCode.RateLimited],
        [502, ShotstackErrorCode.Failed],
    ])("types status %s as %s and carries Shotstack's words", async (status, code) => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status, body: { success: false, message: "Bad Request", response: "Invalid asset url" }, headers: { "retry-after": "7" } })

        const thrown = await failure(client.render(KEY, "stage", EDIT))

        expect(thrown).toMatchObject({ code, params: { status, detail: "Invalid asset url" } })
    })

    it("types a transport failure as unreachable", async () => {
        const { client, http } = await build()
        http.request.mockRejectedValue(new HttpError({ code: HttpErrorCode.Timeout }))

        expect(await failure(client.render(KEY, "stage", EDIT))).toMatchObject({ code: ShotstackErrorCode.Unreachable })
    })
})

describe("ShotstackClient > renderStatus", () => {
    it("gets the render by id with data=false and reads its status, url and error", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: shotstackStatusBody("done", { url: "https://cdn.test/a.mp4" }) })

        await expect(client.renderStatus(KEY, "v1", SHOTSTACK_RENDER_ID)).resolves.toEqual({
            id: SHOTSTACK_RENDER_ID,
            status: "done",
            url: "https://cdn.test/a.mp4",
            error: null,
        })
        expect(http.request).toHaveBeenCalledWith({
            method: "GET",
            url: `${BASE}/v1/render/${SHOTSTACK_RENDER_ID}?data=false`,
            headers: { "x-api-key": KEY },
            timeoutMs: 4000,
        })
    })

    it("sends nothing for an id that is no UUID", async () => {
        const { client, http } = await build()

        expect(await failure(client.renderStatus(KEY, "stage", "../x"))).toMatchObject({ code: ShotstackErrorCode.Rejected })
        expect(http.request).not.toHaveBeenCalled()
    })

    it("reads a status word the docs do not list as malformed", () => {
        expect(() => shotstackRenderOf(shotstackStatusBody("teleporting"))).toThrow()
    })
})

describe("shotstackErrorOf", () => {
    it.each([
        [{ success: false, message: "Bad Request", response: "No timeline" }, "No timeline"],
        [{ success: false, message: "Bad Request", response: { message: "Invalid src" } }, "Invalid src"],
        [{ success: false, message: "Unauthorized" }, "Unauthorized"],
        [{ error: { type: "rate_limit_error", message: "Slow down" } }, "Slow down"],
        [null, ""],
    ])("reads %j as %j", (body, words) => {
        expect(shotstackErrorOf(body)).toBe(words)
    })
})

describe("SHOTSTACK_OPERATIONS", () => {
    it("serves the two compose purposes from the official reference", () => {
        expect(SHOTSTACK_OPERATIONS.renderCreate).toMatchObject({ method: "POST", docs: "https://shotstack.io/docs/api/", serves: "nivo.tool.video.compose" })
        expect(SHOTSTACK_OPERATIONS.renderGet).toMatchObject({ method: "GET", serves: "nivo.tool.video.render.get" })
    })
})
