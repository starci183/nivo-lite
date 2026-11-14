import { readFileSync } from "node:fs"
import type { YoutubeVideoRequest } from "@modules/domain/provider-registry"
import { proofOf, providerRefusalDetail, providerRefusalReason } from "@modules/domain/provider-registry"
import { ProviderSandboxError, ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { YOUTUBE_SANDBOX_CATALOGUE, YOUTUBE_SANDBOX_JOBS, YOUTUBE_SANDBOX_REFUSED_TITLES } from "./youtube-sandbox.catalogue"
import { YoutubeSandboxVideoService } from "./youtube-sandbox-video.service"

const build = () => {
    const account = sandboxAccount({ provider: "google" })
    const { sandbox } = sandboxServiceOf(account)
    const connection = connectionRecord({ provider: "google", id: account.id, workspaceId: account.workspaceId, sandbox: true })
    return { account, sandbox, connection, youtube: new YoutubeSandboxVideoService(sandbox) }
}

const failure = (work: Promise<unknown>): Promise<unknown> => Promise.resolve(work.then(() => undefined, (cause: unknown) => cause))
const video = (title: string, overrides: Partial<YoutubeVideoRequest> = {}): YoutubeVideoRequest => ({
    video: { fileId: "file-1" },
    title,
    description: "",
    tags: [],
    categoryId: null,
    privacyStatus: null,
    publishAt: null,
    madeForKids: null,
    notifySubscribers: null,
    thumbnail: null,
    playlistId: null,
    ...overrides,
})

describe("YoutubeSandboxVideoService", () => {
    it("accepts an upload, then its status walks uploaded, then processed (YOUTUBE-1)", async () => {
        const { youtube, connection } = build()

        await expect(youtube.publish("ws-1", connection, video("Video giới thiệu", { privacyStatus: "unlisted" }))).resolves.toEqual({
            videoId: "sbx-yt-video-000001",
            state: "pending",
            uploadStatus: "uploaded",
            reason: null,
            privacyStatus: "unlisted",
            processingStatus: null,
            playlistItemId: null,
            playlistFailure: null,
        })
        await expect(youtube.status(connection, "sbx-yt-video-000001")).resolves.toMatchObject({ state: "pending", uploadStatus: "uploaded", processingStatus: "processing", privacyStatus: "unlisted" })
        await expect(youtube.status(connection, "sbx-yt-video-000001")).resolves.toMatchObject({ state: "done", uploadStatus: "processed", processingStatus: "succeeded", reason: null })
        await expect(youtube.status(connection, "sbx-yt-video-000001")).resolves.toMatchObject({ state: "done" })
    })

    it("defaults the privacy to private and adds the video to its playlist (YOUTUBE-2)", async () => {
        const { youtube, connection } = build()

        await expect(youtube.publish("ws-1", connection, video("Video", { playlistId: "PL-1" }))).resolves.toMatchObject({
            privacyStatus: "private",
            playlistItemId: "sbx-yt-item-000001",
            playlistFailure: null,
        })
    })

    it("accepts a video whose later status is failed with a failure reason (YOUTUBE-3)", async () => {
        const { youtube, connection } = build()

        await youtube.publish("ws-1", connection, video("Video lỗi xử lý"))

        await expect(youtube.status(connection, "sbx-yt-video-000001")).resolves.toMatchObject({ state: "pending" })
        await expect(youtube.status(connection, "sbx-yt-video-000001")).resolves.toMatchObject({ state: "failed", uploadStatus: "failed", reason: "codec", processingStatus: "failed" })
    })

    it("accepts a video whose later status is rejected with a rejection reason (YOUTUBE-4)", async () => {
        const { youtube, connection } = build()

        await youtube.publish("ws-1", connection, video("Video vi phạm bản quyền"))
        await youtube.status(connection, "sbx-yt-video-000001")

        await expect(youtube.status(connection, "sbx-yt-video-000001")).resolves.toMatchObject({ state: "failed", uploadStatus: "rejected", reason: "copyright" })
    })

    it.each([
        ["Video quá lớn", "not_found", "video file"],
        ["Token Google hết hạn", "auth_refused", "Invalid Credentials"],
    ] as const)("refuses the named title %s as the live twin refuses it (%s, not_sent) and uploads nothing", async (title, reason, detail) => {
        const { youtube, connection, sandbox, account } = build()

        const error = await failure(youtube.publish("ws-1", connection, video(title)))

        expect(providerRefusalReason(error)).toBe(reason)
        expect(providerRefusalDetail(error)).toBe(detail)
        expect(proofOf(error)).toBe("not_sent")
        expect((await sandbox.calls(account, "publish"))[0]?.result.outcome).toBe("threw")
        expect(providerRefusalReason(await failure(youtube.status(connection, "sbx-yt-video-000001")))).toBe("not_found")
    })

    it("refuses a thumbnail not_available before anything is sent, as the live twin does (YOUTUBE-7)", async () => {
        const { youtube, connection } = build()

        const error = await failure(youtube.publish("ws-1", connection, video("Video", { thumbnail: { fileId: "f-2" } })))

        expect(providerRefusalReason(error)).toBe("not_available")
        expect(providerRefusalDetail(error)).toBe("thumbnails.set: docs-missing")
        expect(proofOf(error)).toBe("not_sent")
    })

    it("uploads the video and answers the playlist add as failed for the playlist the account does not hold (YOUTUBE-8)", async () => {
        const { youtube, connection } = build()

        await expect(youtube.publish("ws-1", connection, video("Video", { playlistId: "PL-KHONG-CO" }))).resolves.toMatchObject({
            videoId: "sbx-yt-video-000001",
            playlistItemId: null,
            playlistFailure: "not_found",
        })
        await expect(youtube.status(connection, "sbx-yt-video-000001")).resolves.toMatchObject({ playlistFailure: null })
    })

    it("answers not_found (not_sent) for a video the account never uploaded (YOUTUBE-9)", async () => {
        const { youtube, connection } = build()

        const error = await failure(youtube.status(connection, "nope"))

        expect(providerRefusalReason(error)).toBe("not_found")
        expect(proofOf(error)).toBe("not_sent")
    })

    it("takes one logged call per request and uploads again on a second call (no idempotency)", async () => {
        const { youtube, connection, sandbox, account } = build()

        const first = await youtube.publish("ws-1", connection, video("A"))
        const second = await youtube.publish("ws-1", connection, video("A"))
        await youtube.status(connection, first.videoId)

        expect(second.videoId).toBe("sbx-yt-video-000002")
        expect((await sandbox.calls(account)).map((call) => [call.operation, call.key])).toEqual([
            ["publish", "A"],
            ["publish", "A"],
            ["status", "sbx-yt-video-000001"],
        ])
    })

    it("is deterministic: two fresh accounts answer the same", async () => {
        const one = build()
        const two = build()

        expect(await one.youtube.publish("ws-1", one.connection, video("A"))).toEqual(await two.youtube.publish("ws-1", two.connection, video("A")))
        expect(await one.youtube.status(one.connection, "sbx-yt-video-000001")).toEqual(await two.youtube.status(two.connection, "sbx-yt-video-000001"))
    })

    it("refuses a live account and a switched-off sandbox", async () => {
        const { youtube } = build()
        const live = await failure(youtube.status(connectionRecord({ provider: "google", id: "live-1" }), "x"))
        expect(live).toBeInstanceOf(ProviderSandboxError)
        expect((live as ProviderSandboxError).code).toBe(ProviderSandboxErrorCode.LiveAccount)

        const account = sandboxAccount({ provider: "google" })
        const off = new YoutubeSandboxVideoService(sandboxServiceOff(account).sandbox)
        const refused = await failure(off.status(connectionRecord({ provider: "google", id: account.id, sandbox: true }), "x"))
        expect((refused as ProviderSandboxError).code).toBe(ProviderSandboxErrorCode.Off)
    })

    it("has a catalogue of unique YOUTUBE-<n> ids with every named title wired to its case, and no inbound case (a video is polled)", () => {
        const ids = YOUTUBE_SANDBOX_CATALOGUE.cases.map((one) => one.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.every((id) => /^YOUTUBE-\d+$/.test(id))).toBe(true)
        expect(Object.values(YOUTUBE_SANDBOX_REFUSED_TITLES).every((one) => ids.includes(one.caseId))).toBe(true)
        expect(Object.values(YOUTUBE_SANDBOX_JOBS).every((one) => ids.includes(one.caseId))).toBe(true)
        expect(YOUTUBE_SANDBOX_CATALOGUE.cases.every((one) => one.inbound === undefined)).toBe(true)
    })

    it("reaches no host: one constructor parameter and no integration or network word in its source", () => {
        expect(YoutubeSandboxVideoService.length).toBe(1)
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})
