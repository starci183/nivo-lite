import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT, HttpError, HttpErrorCode } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { YoutubeErrorCode } from "./errors/youtube.error"
import { YoutubeClient, uploadBodyOf } from "./youtube.client"
import { YOUTUBE_OPTIONS } from "./youtube.decorators"
import { YOUTUBE_OPERATIONS } from "./youtube.operations"
import type { YoutubeUploadMetadata } from "./youtube.contracts"
import type { YoutubeOptions } from "./youtube.options"

const BASE = "https://www.googleapis.com"
const options: YoutubeOptions = { apiBase: BASE, timeoutMs: 4000, uploadTimeoutMs: 9000, maxUploadBytes: 1000 }
const TOKEN = ["test", "token"].join("-")
const SESSION = `${BASE}/upload/youtube/v3/videos?uploadType=resumable&upload_id=xa298sd_sdlkj2`

const metadata: YoutubeUploadMetadata = {
    title: "My video",
    description: "About it",
    tags: ["a", "b c"],
    categoryId: "22",
    privacyStatus: "private",
    publishAt: null,
    madeForKids: false,
    notifySubscribers: null,
}

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [YoutubeClient, { provide: HTTP_CLIENT, useValue: http }, { provide: YOUTUBE_OPTIONS, useValue: options }],
    }).compile()
    return { client: moduleRef.get(YoutubeClient), http }
}

const failure = (work: Promise<unknown>): Promise<unknown> => Promise.resolve(work.then(() => undefined, (cause: unknown) => cause))

/** The error shape of https://developers.google.com/youtube/v3/docs/errors: an HTTP status and a `reason`. */
const errorBody = (code: number, reason: string) => ({ error: { code, message: "A message", errors: [{ domain: "youtube.video", reason }] } })

describe("YoutubeClient > resumable upload (https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol)", () => {
    it("starts a session with the video resource and the upload headers and reads the Location", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, headers: { location: SESSION }, body: {} })

        await expect(client.startUpload(TOKEN, metadata, 512, "video/mp4")).resolves.toBe(SESSION)
        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: `${BASE}/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`,
            headers: {
                authorization: `Bearer ${TOKEN}`,
                "content-type": "application/json; charset=UTF-8",
                "x-upload-content-length": "512",
                "x-upload-content-type": "video/mp4",
            },
            body: {
                snippet: { title: "My video", description: "About it", tags: ["a", "b c"], categoryId: "22" },
                status: { privacyStatus: "private", selfDeclaredMadeForKids: false },
            },
            timeoutMs: 4000,
        })
    })

    it("sends `notifySubscribers` only when it is set, and sends no member it was not given", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, headers: { location: SESSION }, body: {} })

        await client.startUpload(TOKEN, { ...metadata, notifySubscribers: false }, 5, "video/mp4")
        expect(http.request.mock.calls.some(([sent]) => sent.url.includes("&notifySubscribers=false"))).toBe(true)
        expect(uploadBodyOf({ ...metadata, tags: [], categoryId: null, privacyStatus: null, madeForKids: null })).toEqual({
            snippet: { title: "My video", description: "About it" },
            status: {},
        })
    })

    it("refuses a session address that is not on Google's origin, both when read and when put to", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, headers: { location: "https://evil.example/upload" }, body: {} })
        await expect(failure(client.startUpload(TOKEN, metadata, 5, "video/mp4"))).resolves.toMatchObject({ code: YoutubeErrorCode.Malformed })

        http.request.mockClear()
        await expect(failure(client.upload(TOKEN, "https://evil.example/upload", Buffer.from("x"), "video/mp4"))).resolves.toMatchObject({
            code: YoutubeErrorCode.Rejected,
        })
        expect(http.request).not.toHaveBeenCalled()
    })

    it("puts the bytes to the session and reads the created video resource (201)", async () => {
        const { client, http } = await build()
        const bytes = Buffer.from("video")
        http.request.mockResolvedValue({ status: 201, body: { kind: "youtube#video", id: "abc123", status: { uploadStatus: "uploaded", privacyStatus: "private" } } })

        await expect(client.upload(TOKEN, SESSION, bytes, "video/mp4")).resolves.toEqual({
            videoId: "abc123",
            uploadStatus: "uploaded",
            reason: null,
            privacyStatus: "private",
            processingStatus: null,
        })
        expect(http.request).toHaveBeenCalledWith({
            method: "PUT",
            url: SESSION,
            headers: { authorization: `Bearer ${TOKEN}`, "content-type": "video/mp4" },
            bytes,
            timeoutMs: 9000,
        })
    })

    it("treats a 308 (incomplete) on the one-shot put as a failure that may have acted", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 308, headers: { range: "bytes=0-9" }, body: "" })

        await expect(failure(client.upload(TOKEN, SESSION, Buffer.from("x"), "video/mp4"))).resolves.toMatchObject({ code: YoutubeErrorCode.Failed })
    })
})

describe("YoutubeClient > playlist and status", () => {
    it("adds a video to a playlist (https://developers.google.com/youtube/v3/docs/playlistItems/insert) and reads the item id", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { kind: "youtube#playlistItem", id: "UEx4" } })

        await expect(client.addToPlaylist(TOKEN, "PLabc_1", "abc123")).resolves.toBe("UEx4")
        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: `${BASE}/youtube/v3/playlistItems?part=snippet`,
            headers: { authorization: `Bearer ${TOKEN}` },
            body: { snippet: { playlistId: "PLabc_1", resourceId: { kind: "youtube#video", videoId: "abc123" } } },
            timeoutMs: 4000,
        })
    })

    it("reads a video's status and processing details (https://developers.google.com/youtube/v3/docs/videos/list)", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({
            status: 200,
            body: {
                kind: "youtube#videoListResponse",
                pageInfo: { totalResults: 1, resultsPerPage: 1 },
                items: [{ id: "abc123", status: { uploadStatus: "rejected", rejectionReason: "duplicate", privacyStatus: "private" }, processingDetails: { processingStatus: "terminated" } }],
            },
        })

        await expect(client.video(TOKEN, "abc123")).resolves.toEqual({
            videoId: "abc123",
            uploadStatus: "rejected",
            reason: "duplicate",
            privacyStatus: "private",
            processingStatus: "terminated",
        })
        expect(http.request).toHaveBeenCalledWith(expect.objectContaining({ url: `${BASE}/youtube/v3/videos?part=status,processingDetails&id=abc123` }))
    })

    it("answers `NotFound` when the list holds no item, and refuses an id that is no query value", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { items: [] } })
        await expect(failure(client.video(TOKEN, "abc123"))).resolves.toMatchObject({ code: YoutubeErrorCode.NotFound })

        http.request.mockClear()
        await expect(failure(client.video(TOKEN, "a&b"))).resolves.toMatchObject({ code: YoutubeErrorCode.Rejected })
        expect(http.request).not.toHaveBeenCalled()
    })
})

describe("YoutubeClient > failures", () => {
    it.each([
        [403, "quotaExceeded", YoutubeErrorCode.RateLimited],
        [429, "uploadRateLimitExceeded", YoutubeErrorCode.RateLimited],
        [403, "insufficientPermissions", YoutubeErrorCode.AuthFailed],
        [401, "youtubeSignupRequired", YoutubeErrorCode.AuthFailed],
        [403, "forbidden", YoutubeErrorCode.AuthFailed],
        [403, "forbiddenPrivacySetting", YoutubeErrorCode.Rejected],
        [403, "playlistContainsMaximumNumberOfVideos", YoutubeErrorCode.Rejected],
        [400, "invalidTitle", YoutubeErrorCode.Rejected],
        [400, "uploadLimitExceeded", YoutubeErrorCode.Rejected],
        [404, "playlistNotFound", YoutubeErrorCode.NotFound],
        [503, "backendError", YoutubeErrorCode.Failed],
    ])("types status %s reason %s", async (status, reason, code) => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status, body: errorBody(status, reason) })

        await expect(failure(client.addToPlaylist(TOKEN, "PL1", "v1"))).resolves.toMatchObject({ code, params: { status, reason } })
    })

    it("types a transport failure as unreachable", async () => {
        const { client, http } = await build()
        http.request.mockRejectedValue(new HttpError({ code: HttpErrorCode.Network }))

        await expect(failure(client.addToPlaylist(TOKEN, "PL1", "v1"))).resolves.toMatchObject({ code: YoutubeErrorCode.Unreachable })
    })
})

describe("YOUTUBE_OPERATIONS", () => {
    it("states four built operations and one docs-missing (thumbnails.set), each with its documentation", () => {
        const operations = Object.values(YOUTUBE_OPERATIONS)
        expect(operations.filter((operation) => operation.status === "built")).toHaveLength(4)
        expect(operations.filter((operation) => operation.status === "docs-missing")).toHaveLength(1)
        expect(YOUTUBE_OPERATIONS.thumbnailsSet.docs.startsWith("docs-missing:")).toBe(true)
    })
})
