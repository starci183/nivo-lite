import { mock } from "@starci/jest-preset"
import type { ConnectionRecord, Provider } from "@modules/domain/connections"
import type { GoogleTokensService } from "@modules/domain/google-connections"
import { proofOf, ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import type { PublishFileSource, YoutubeVideoRequest } from "@modules/domain/provider-registry"
import { YoutubeError, YoutubeErrorCode } from "@modules/integrations/youtube"
import type { YoutubeClient } from "@modules/integrations/youtube"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { YoutubeCredentialService } from "./youtube-credential.service"
import { YoutubeVideoService, videoStateOf } from "./youtube-video.service"

const TOKEN = ["access", "token"].join("-")
const SESSION = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=xa298"
const account = (meta: Record<string, string> = { youtube: "granted" }, provider: Provider = "google"): ConnectionRecord =>
    connectionRecord({ id: "conn-g", workspaceId: "ws-1", provider, name: "Google", meta })

const request: YoutubeVideoRequest = {
    video: { fileId: "file-1" },
    title: "My video",
    description: "About it",
    tags: ["a"],
    categoryId: "22",
    privacyStatus: "private",
    publishAt: null,
    madeForKids: false,
    notifySubscribers: null,
    thumbnail: null,
    playlistId: null,
}

const UPLOADED = { videoId: "abc123", uploadStatus: "uploaded", reason: null, privacyStatus: "private", processingStatus: null }

const build = (files: PublishFileSource | undefined = undefined) => {
    const fake = mock<PublishFileSource>()
    const source = files ?? fake
    if (files === undefined) fake.read.mockResolvedValue({ bytes: Buffer.from("video"), mimeType: "video/mp4" })
    const tokens = mock<GoogleTokensService>()
    tokens.accessToken.mockResolvedValue(TOKEN)
    tokens.withRetry.mockImplementation(async (token, work) => work(await token(false)))
    const client = mock<YoutubeClient>()
    Object.defineProperty(client, "maxUploadBytes", { value: 1000 })
    return { service: new YoutubeVideoService(client, new YoutubeCredentialService(tokens), source), client, tokens, source, fake }
}

const failure = (work: Promise<unknown>): Promise<unknown> => Promise.resolve(work.then(() => undefined, (cause: unknown) => cause))

describe("YoutubeVideoService > publish", () => {
    it("reads the stored file, starts the resumable session with its size and type, uploads it and answers the video pending", async () => {
        const { service, client } = build()
        client.startUpload.mockResolvedValue(SESSION)
        client.upload.mockResolvedValue(UPLOADED)

        await expect(service.publish("ws-1", account(), request)).resolves.toEqual({
            videoId: "abc123",
            state: "pending",
            uploadStatus: "uploaded",
            reason: null,
            privacyStatus: "private",
            processingStatus: null,
            playlistItemId: null,
            playlistFailure: null,
        })
        expect(client.startUpload).toHaveBeenCalledWith(
            TOKEN,
            expect.objectContaining({ title: "My video", categoryId: "22", privacyStatus: "private", madeForKids: false }),
            5,
            "video/mp4",
        )
        expect(client.upload).toHaveBeenCalledWith(TOKEN, SESSION, Buffer.from("video"), "video/mp4")
    })

    it("adds the video to the playlist, and answers a playlist refusal after the upload without undoing it", async () => {
        const { service, client } = build()
        client.startUpload.mockResolvedValue(SESSION)
        client.upload.mockResolvedValue(UPLOADED)
        client.addToPlaylist.mockResolvedValueOnce("UEx4")
        await expect(service.publish("ws-1", account(), { ...request, playlistId: "PL1" })).resolves.toMatchObject({ playlistItemId: "UEx4", playlistFailure: null })

        client.addToPlaylist.mockRejectedValueOnce(new YoutubeError({ code: YoutubeErrorCode.NotFound, params: { status: 404, reason: "playlistNotFound", detail: "" } }))
        await expect(service.publish("ws-1", account(), { ...request, playlistId: "PL1" })).resolves.toMatchObject({
            videoId: "abc123",
            playlistItemId: null,
            playlistFailure: "not_found",
        })
    })

    it("refuses before anything is sent: a thumbnail (docs-missing), no file store, no file, a media type that is no video, no YouTube grant", async () => {
        const { service, client, fake } = build()
        const thumbnail = await failure(service.publish("ws-1", account(), { ...request, thumbnail: { fileId: "t" } }))
        expect(thumbnail).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNotAvailable })
        expect(proofOf(thumbnail)).toBe("not_sent")

        const noStore = await failure(new YoutubeVideoService(client, new YoutubeCredentialService(mock<GoogleTokensService>()), undefined).publish("ws-1", account(), request))
        expect(noStore).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNotAvailable })

        fake.read.mockResolvedValueOnce(null)
        expect(await failure(service.publish("ws-1", account(), request))).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNotFound })

        fake.read.mockResolvedValueOnce({ bytes: Buffer.from("x"), mimeType: "image/png" })
        expect(await failure(service.publish("ws-1", account(), request))).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected })

        const ungranted = await failure(service.publish("ws-1", account({}), request))
        expect(ungranted).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNoCredential })
        expect(proofOf(ungranted)).toBe("not_sent")
        expect(client.startUpload).not.toHaveBeenCalled()
    })

    it("proves a refused request `not_sent` and a lost connection or a 5xx `unknown`", async () => {
        const { service, client } = build()
        client.startUpload.mockRejectedValueOnce(new YoutubeError({ code: YoutubeErrorCode.Rejected, params: { status: 400, reason: "invalidTitle", detail: "bad" } }))
        const refused = await failure(service.publish("ws-1", account(), request))
        expect(refused).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected, params: { detail: "bad" } })
        expect(proofOf(refused)).toBe("not_sent")

        client.startUpload.mockResolvedValue(SESSION)
        client.upload.mockRejectedValueOnce(new YoutubeError({ code: YoutubeErrorCode.Unreachable }))
        expect(proofOf(await failure(service.publish("ws-1", account(), request)))).toBe("unknown")
    })
})

describe("YoutubeVideoService > status", () => {
    it("reads the video and maps the documented upload statuses", async () => {
        const { service, client } = build()
        client.video.mockResolvedValue({ videoId: "abc123", uploadStatus: "processed", reason: null, privacyStatus: "public", processingStatus: "succeeded" })

        await expect(service.status(account(), "abc123")).resolves.toMatchObject({ state: "done", uploadStatus: "processed", processingStatus: "succeeded" })
        expect(videoStateOf({ ...UPLOADED, uploadStatus: "rejected" })).toBe("failed")
        expect(videoStateOf({ ...UPLOADED, uploadStatus: "failed" })).toBe("failed")
        expect(videoStateOf({ ...UPLOADED, uploadStatus: "deleted" })).toBe("failed")
        expect(videoStateOf({ ...UPLOADED, uploadStatus: "uploaded" })).toBe("pending")
        expect(videoStateOf({ ...UPLOADED, uploadStatus: null })).toBe("pending")
    })

    it("answers a video YouTube does not list as the not_found refusal", async () => {
        const { service, client } = build()
        client.video.mockRejectedValue(new YoutubeError({ code: YoutubeErrorCode.NotFound, params: { status: 200, reason: "videoNotFound", detail: "" } }))

        expect(await failure(service.status(account(), "abc123"))).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNotFound })
    })
})
