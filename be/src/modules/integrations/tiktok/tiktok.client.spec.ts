import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { HTTP_CLIENT, HttpError, HttpErrorCode } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { TiktokErrorCode } from "./errors/tiktok.error"
import { TiktokClient, chunkPlanOf, chunkRangesOf, quoteIds } from "./tiktok.client"
import { TIKTOK_OPTIONS } from "./tiktok.decorators"
import { TIKTOK_OPERATIONS } from "./tiktok.operations"
import type { TiktokInitRequest } from "./tiktok.contracts"
import type { TiktokOptions } from "./tiktok.options"

const BASE = "https://open.tiktokapis.com"
const TOKEN = ["act", "example"].join(".")
const options: TiktokOptions = {
    apiBase: BASE,
    client: { clientKey: "app-key", clientSecret: new Secret("app-secret") },
    timeoutMs: 4000,
    uploadTimeoutMs: 9000,
}

/** The creator info response (https://developers.tiktok.com/doc/content-posting-api-reference-query-creator-info, example response). */
const CREATOR = {
    data: {
        creator_avatar_url: "https://lf16-tt4d.tiktokcdn.com/obj/tiktok-open-platform/8d5740ac3844be417beeacd0df75aef1",
        creator_username: "tiktok",
        creator_nickname: "TikTok Official",
        privacy_level_options: ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"],
        comment_disabled: false,
        duet_disabled: false,
        stitch_disabled: true,
        max_video_post_duration_sec: 300,
    },
    error: { code: "ok", message: "", log_id: "202210112248442CB9319E1FB30C1073F3" },
}

/** The direct post init response for FILE_UPLOAD (https://developers.tiktok.com/doc/content-posting-api-reference-direct-post, example response). */
const INIT_UPLOAD = {
    data: { publish_id: "v_pub_file~v2-1.123456789", upload_url: "https://open-upload.tiktokapis.com/video/?upload_id=67890&upload_token=Xza123" },
    error: { code: "ok", message: "", logid: "202210112248442CB9319E1FB30C1073F3" },
}

/** The post is still being pulled (status fetch reference: `PROCESSING_DOWNLOAD`, `downloaded_bytes`). */
const PROCESSING = { data: { status: "PROCESSING_DOWNLOAD", downloaded_bytes: 1024 }, error: { code: "ok", message: "", log_id: "x" } }

/** A failed post (status fetch reference example: `FAILED`, `picture_size_check_failed`). */
const FAILED = { data: { status: "FAILED", fail_reason: "picture_size_check_failed" }, error: { code: "ok", message: "", log_id: "x" } }

/** A refreshed token (https://developers.tiktok.com/doc/oauth-refresh-a-user-access-token, example response). */
const REFRESHED = {
    access_token: "act.example12345Example12345Example",
    expires_in: 86400,
    open_id: "afd97af1-b87b-4...",
    refresh_expires_in: 31536000,
    refresh_token: "rft.example12345Example12345Example",
    scope: "user.info.basic,video.list",
    token_type: "Bearer",
}

const pull: TiktokInitRequest = {
    privacyLevel: "SELF_ONLY",
    title: null,
    disableDuet: null,
    disableStitch: null,
    disableComment: null,
    coverTimestampMs: null,
    brandContentToggle: null,
    brandOrganicToggle: null,
    isAigc: null,
    source: { kind: "pull", videoUrl: "https://cdn.example.com/v.mp4" },
}

/** What a call throws, or undefined when it returns. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [TiktokClient, { provide: HTTP_CLIENT, useValue: http }, { provide: TIKTOK_OPTIONS, useValue: options }],
    }).compile()
    return { client: moduleRef.get(TiktokClient), http }
}

describe("TiktokClient > creatorInfo", () => {
    it("posts with the bearer token and no body, and reads the creator's limits", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: CREATOR })

        await expect(client.creatorInfo(TOKEN)).resolves.toEqual({
            username: "tiktok",
            nickname: "TikTok Official",
            privacyLevelOptions: ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"],
            commentDisabled: false,
            duetDisabled: false,
            stitchDisabled: true,
            maxVideoPostDurationSec: 300,
        })
        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: `${BASE}/v2/post/publish/creator_info/query/`,
            headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json; charset=UTF-8" },
            timeoutMs: 4000,
        })
    })

    it("types a 200 whose error.code is not ok as a refusal (spam_risk_too_many_posts)", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { data: {}, error: { code: "spam_risk_too_many_posts", message: "cap" } } })

        await expect(client.creatorInfo(TOKEN)).rejects.toMatchObject({
            code: TiktokErrorCode.Rejected,
            params: { word: "spam_risk_too_many_posts" },
        })
    })
})

describe("TiktokClient > initPost", () => {
    it("sends a PULL_FROM_URL post with only the members given", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { data: { publish_id: "v_pub_url~v2-1.1" }, error: { code: "ok", message: "" } } })

        await expect(
            client.initPost(TOKEN, { ...pull, title: "caption #x", disableDuet: true, coverTimestampMs: 1000 }),
        ).resolves.toEqual({ publishId: "v_pub_url~v2-1.1", uploadUrl: null })
        expect(http.request.mock.calls[0]?.[0]).toMatchObject({
            method: "POST",
            url: `${BASE}/v2/post/publish/video/init/`,
            body: {
                post_info: { privacy_level: "SELF_ONLY", title: "caption #x", disable_duet: true, video_cover_timestamp_ms: 1000 },
                source_info: { source: "PULL_FROM_URL", video_url: "https://cdn.example.com/v.mp4" },
            },
        })
        expect(http.request.mock.calls[0]?.[0].body).not.toHaveProperty("post_info.disable_stitch")
    })

    it("sends a FILE_UPLOAD post with the chunk plan and reads the upload url", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: INIT_UPLOAD })
        const plan = { videoSize: 50_000_123, chunkSize: 10_000_000, totalChunkCount: 5 }

        await expect(client.initPost(TOKEN, { ...pull, privacyLevel: "MUTUAL_FOLLOW_FRIENDS", source: { kind: "upload", plan } })).resolves.toEqual({
            publishId: "v_pub_file~v2-1.123456789",
            uploadUrl: INIT_UPLOAD.data.upload_url,
        })
        expect(http.request.mock.calls[0]?.[0].body).toMatchObject({
            source_info: { source: "FILE_UPLOAD", video_size: 50_000_123, chunk_size: 10_000_000, total_chunk_count: 5 },
        })
    })

    it.each([
        [400, "invalid_param", TiktokErrorCode.Rejected],
        [403, "privacy_level_option_mismatch", TiktokErrorCode.Rejected],
        [403, "url_ownership_unverified", TiktokErrorCode.Rejected],
        [403, "unaudited_client_can_only_post_to_private_accounts", TiktokErrorCode.Rejected],
        [401, "access_token_invalid", TiktokErrorCode.AuthFailed],
        [401, "scope_not_authorized", TiktokErrorCode.AuthFailed],
        [429, "rate_limit_exceeded", TiktokErrorCode.RateLimited],
        [500, "internal_error", TiktokErrorCode.Failed],
    ])("types an answered %i %s as %s, with TikTok's code word", async (status, word, code) => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status, body: { data: {}, error: { code: word, message: "m", log_id: "l" } } })

        await expect(client.initPost(TOKEN, pull)).rejects.toMatchObject({ code, params: { status, word } })
    })

    it("types a transport failure as unreachable", async () => {
        const { client, http } = await build()
        http.request.mockRejectedValue(new HttpError({ code: HttpErrorCode.Network }))

        await expect(client.initPost(TOKEN, pull)).rejects.toMatchObject({ code: TiktokErrorCode.Unreachable })
    })

    it("refuses an init answered without a publish id as unreadable", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { data: {}, error: { code: "ok", message: "" } } })

        await expect(client.initPost(TOKEN, pull)).rejects.toMatchObject({ code: TiktokErrorCode.Malformed })
    })
})

describe("chunk plan (media transfer guide)", () => {
    it("sends a file up to 64 MB as one chunk of its own size", () => {
        expect(chunkPlanOf(30_567_100)).toEqual({ videoSize: 30_567_100, chunkSize: 30_567_100, totalChunkCount: 1 })
        expect(chunkRangesOf(chunkPlanOf(30_567_100))).toEqual([{ first: 0, last: 30_567_099 }])
    })

    it("cuts a file over 64 MB in 64 MB chunks, the last absorbing the rest", () => {
        const size = 150 * 1024 ** 2
        const plan = chunkPlanOf(size)
        expect(plan).toEqual({ videoSize: size, chunkSize: 64 * 1024 ** 2, totalChunkCount: 2 })
        const ranges = chunkRangesOf(plan)
        expect(ranges[0]).toEqual({ first: 0, last: 64 * 1024 ** 2 - 1 })
        expect(ranges[1]).toEqual({ first: 64 * 1024 ** 2, last: size - 1 })
    })

    it("refuses an empty file and one over 4 GB", () => {
        expect(thrownBy(() => chunkPlanOf(0))).toMatchObject({ code: TiktokErrorCode.Rejected })
        expect(thrownBy(() => chunkPlanOf(4 * 1024 ** 3 + 1))).toMatchObject({ code: TiktokErrorCode.Rejected })
    })
})

describe("TiktokClient > uploadVideo", () => {
    it("puts each chunk in order with its Content-Range and ends on 201", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValueOnce({ status: 206, body: undefined }).mockResolvedValueOnce({ status: 201, body: undefined })
        const bytes = Buffer.alloc(10)
        const plan = { videoSize: 10, chunkSize: 5, totalChunkCount: 2 }

        await client.uploadVideo(INIT_UPLOAD.data.upload_url, bytes, "video/mp4", plan)

        const calls = http.request.mock.calls.map((call) => call[0])
        expect(calls[0]).toMatchObject({
            method: "PUT",
            url: INIT_UPLOAD.data.upload_url,
            headers: { "content-type": "video/mp4", "content-length": "5", "content-range": "bytes 0-4/10" },
        })
        expect(calls[1]?.headers?.["content-range"]).toBe("bytes 5-9/10")
        expect(calls[0]?.headers).not.toHaveProperty("authorization")
    })

    it("reads a last answer that is not 201 as an incomplete upload", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 206, body: undefined })

        await expect(client.uploadVideo(INIT_UPLOAD.data.upload_url, Buffer.alloc(4), "video/mp4", chunkPlanOf(4))).rejects.toMatchObject({
            code: TiktokErrorCode.Malformed,
        })
    })

    it.each([
        [403, TiktokErrorCode.Rejected],
        [416, TiktokErrorCode.Rejected],
        [404, TiktokErrorCode.NotFound],
        [500, TiktokErrorCode.Failed],
    ])("types an upload answered %i as %s", async (status, code) => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status, body: undefined })

        await expect(client.uploadVideo(INIT_UPLOAD.data.upload_url, Buffer.alloc(4), "video/mp4", chunkPlanOf(4))).rejects.toMatchObject({ code })
    })

    it("never sends the bytes to another host or over http", async () => {
        const { client, http } = await build()
        const plan = chunkPlanOf(4)

        await expect(client.uploadVideo("https://evil.test/up", Buffer.alloc(4), "video/mp4", plan)).rejects.toMatchObject({ code: TiktokErrorCode.Rejected })
        await expect(client.uploadVideo("http://open-upload.tiktokapis.com/x", Buffer.alloc(4), "video/mp4", plan)).rejects.toMatchObject({
            code: TiktokErrorCode.Rejected,
        })
        expect(http.request).not.toHaveBeenCalled()
    })
})

describe("TiktokClient > status", () => {
    it("posts the publish id and reads a pending post", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: JSON.stringify(PROCESSING) })

        await expect(client.status(TOKEN, "v_pub_url~v2-1.1")).resolves.toEqual({
            status: "PROCESSING_DOWNLOAD",
            failReason: null,
            postIds: [],
            uploadedBytes: null,
            downloadedBytes: 1024,
        })
        expect(http.request.mock.calls[0]?.[0]).toMatchObject({
            url: `${BASE}/v2/post/publish/status/fetch/`,
            body: { publish_id: "v_pub_url~v2-1.1" },
            read: "text",
        })
    })

    it("reads a failed post with its reason", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: JSON.stringify(FAILED) })

        await expect(client.status(TOKEN, "p")).resolves.toMatchObject({ status: "FAILED", failReason: "picture_size_check_failed" })
    })

    it("keeps every digit of an int64 post id", async () => {
        const { client, http } = await build()
        const text = '{"data":{"status":"PUBLISH_COMPLETE","publicaly_available_post_id":[7123456789012345678]},"error":{"code":"ok","message":""}}'
        http.request.mockResolvedValue({ status: 200, body: text })

        await expect(client.status(TOKEN, "p")).resolves.toMatchObject({ status: "PUBLISH_COMPLETE", postIds: ["7123456789012345678"] })
        expect(quoteIds(text)).toContain('["7123456789012345678"]')
    })

    it.each([
        [400, "invalid_publish_id", TiktokErrorCode.Rejected],
        [400, "token_not_authorized_for_specified_publish_id", TiktokErrorCode.Rejected],
        [401, "access_token_invalid", TiktokErrorCode.AuthFailed],
        [429, "rate_limit_exceeded", TiktokErrorCode.RateLimited],
        [500, "internal_error", TiktokErrorCode.Failed],
    ])("types an answered %i %s as %s", async (status, word, code) => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status, body: JSON.stringify({ data: {}, error: { code: word, message: "m", log_id: "l" } }) })

        await expect(client.status(TOKEN, "p")).rejects.toMatchObject({ code, params: { word } })
    })
})

describe("TiktokClient > refresh", () => {
    it("posts the app client and the refresh token as a form and reads the rotated tokens", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: REFRESHED })

        await expect(client.refresh("rft.old")).resolves.toEqual({
            accessToken: "act.example12345Example12345Example",
            refreshToken: "rft.example12345Example12345Example",
            expiresInSeconds: 86400,
        })
        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: `${BASE}/v2/oauth/token/`,
            form: { client_key: "app-key", client_secret: "app-secret", grant_type: "refresh_token", refresh_token: "rft.old" },
            timeoutMs: 4000,
        })
    })

    it("reads a dead refresh token (invalid_grant) as a refused credential", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 400, body: { error: "invalid_grant", error_description: "revoked", log_id: "l" } })

        await expect(client.refresh("rft.old")).rejects.toMatchObject({ code: TiktokErrorCode.AuthFailed, params: { word: "invalid_grant" } })
    })

    it("sends nothing when this deployment has no app client", async () => {
        const http = mock<HttpClient>()
        const moduleRef = await Test.createTestingModule({
            providers: [TiktokClient, { provide: HTTP_CLIENT, useValue: http }, { provide: TIKTOK_OPTIONS, useValue: { ...options, client: null } }],
        }).compile()

        await expect(moduleRef.get(TiktokClient).refresh("rft")).rejects.toMatchObject({ code: TiktokErrorCode.NotConfigured })
        expect(http.request).not.toHaveBeenCalled()
    })
})

describe("the TikTok operations", () => {
    it("names every operation by the API law of its provider, every one built from the documentation", () => {
        expect(Object.values(TIKTOK_OPERATIONS)).toHaveLength(5)
        for (const operation of Object.values(TIKTOK_OPERATIONS)) {
            expect(operation.api.startsWith("nivo.api.tiktok.")).toBe(true)
            expect(operation.status).toBe("built")
            expect(operation.docs.startsWith("https://developers.tiktok.com/doc/")).toBe(true)
        }
    })
})
