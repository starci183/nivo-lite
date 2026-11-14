import { mock } from "@starci/jest-preset"
import type { ConnectionRecord, ConnectionsService, Provider } from "@modules/domain/connections"
import { proofOf, providerRefusalReason, ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import type { ProviderFile, TiktokPublishRequest } from "@modules/domain/provider-registry"
import { TiktokError, TiktokErrorCode } from "@modules/integrations/tiktok"
import type { TiktokClient } from "@modules/integrations/tiktok"
import type { Clock } from "@modules/platform/clock"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { TiktokCredentialService, tiktokTokensOf } from "./tiktok-credential.service"
import { TiktokVideoService, publishStateOf } from "./tiktok-video.service"

const NOW = Date.parse("2026-11-13T00:00:00.000Z")
const account = (provider: Provider = "tiktok"): ConnectionRecord => connectionRecord({ id: "conn-t", workspaceId: "ws-1", provider, name: "TikTok", meta: {} })

const request: TiktokPublishRequest = {
    source: { kind: "url", videoUrl: "https://cdn.example.com/v.mp4" },
    privacyLevel: "SELF_ONLY",
    title: "hi",
    disableDuet: null,
    disableStitch: null,
    disableComment: null,
    coverTimestampMs: null,
    brandContentToggle: null,
    brandOrganicToggle: null,
    isAigc: null,
}

const build = (stored: Record<string, unknown> = { accessToken: "act.one", refreshToken: "rft.one", expiresAt: NOW + 3_600_000 }) => {
    const connections = mock<ConnectionsService>()
    connections.readSecret.mockResolvedValue({ plain: JSON.stringify(stored), webhookSecret: "hook" })
    const client = mock<TiktokClient>()
    const clock = mock<Clock>()
    clock.now.mockReturnValue(new Date(NOW))
    const credentials = new TiktokCredentialService(connections, client, clock)
    return { connections, client, service: new TiktokVideoService(client, credentials) }
}

describe("TiktokVideoService > publish", () => {
    it("starts a PULL_FROM_URL post with the stored token and answers the publish id", async () => {
        const { service, client } = build()
        client.initPost.mockResolvedValue({ publishId: "v_pub_url~1", uploadUrl: null })

        await expect(service.publish(account(), request)).resolves.toEqual({ publishId: "v_pub_url~1" })
        expect(client.initPost).toHaveBeenCalledWith("act.one", expect.objectContaining({ privacyLevel: "SELF_ONLY", title: "hi", source: { kind: "pull", videoUrl: "https://cdn.example.com/v.mp4" } }))
    })

    it("uploads a file source in chunks after the init", async () => {
        const { service, client } = build()
        client.initPost.mockResolvedValue({ publishId: "v_pub_file~1", uploadUrl: "https://open-upload.tiktokapis.com/video/?u=1" })
        const bytes = Buffer.alloc(8)
        const file: ProviderFile = { provider: "x", handle: "h", mimeType: "video/quicktime", expiresAt: null, fetch: () => Promise.resolve(bytes) }

        await service.publish(account(), { ...request, source: { kind: "file", file } })

        expect(client.initPost).toHaveBeenCalledWith(
            "act.one",
            expect.objectContaining({ source: { kind: "upload", plan: { videoSize: 8, chunkSize: 8, totalChunkCount: 1 } } }),
        )
        expect(client.uploadVideo).toHaveBeenCalledWith("https://open-upload.tiktokapis.com/video/?u=1", bytes, "video/quicktime", { videoSize: 8, chunkSize: 8, totalChunkCount: 1 })
    })

    it("refreshes the token once when TikTok refuses it, seals the rotated tokens, and repeats the call", async () => {
        const { service, client, connections } = build()
        client.initPost
            .mockRejectedValueOnce(new TiktokError({ code: TiktokErrorCode.AuthFailed, params: { status: 401, word: "access_token_invalid", detail: "" } }))
            .mockResolvedValueOnce({ publishId: "p2", uploadUrl: null })
        client.refresh.mockResolvedValue({ accessToken: "act.two", refreshToken: "rft.two", expiresInSeconds: 7200 })

        await expect(service.publish(account(), request)).resolves.toEqual({ publishId: "p2" })
        expect(client.refresh).toHaveBeenCalledWith("rft.one")
        expect(tiktokTokensOf(connections.writeSecret.mock.calls[0]?.[1] ?? "")).toEqual({ accessToken: "act.two", refreshToken: "rft.two", expiresAt: NOW + 7_200_000 })
        expect(client.initPost).toHaveBeenLastCalledWith("act.two", expect.anything())
    })

    it("refreshes first when the stored token is past its expiry", async () => {
        const { service, client } = build({ accessToken: "act.old", refreshToken: "rft.one", expiresAt: NOW - 1 })
        client.refresh.mockResolvedValue({ accessToken: "act.new", refreshToken: "rft.new", expiresInSeconds: 7200 })
        client.initPost.mockResolvedValue({ publishId: "p", uploadUrl: null })

        await service.publish(account(), request)
        expect(client.initPost).toHaveBeenCalledWith("act.new", expect.anything())
    })

    it("refuses an account with no token, proved not_sent, and sends nothing", async () => {
        const { service, client } = build({})

        await expect(service.publish(account(), request)).rejects.toMatchObject({ code: ProviderRegistryErrorCode.RefusedNoCredential })
        expect(client.initPost).not.toHaveBeenCalled()
    })

    it("refuses an account of another provider", async () => {
        const { service } = build()

        await expect(service.publish(account("meta"), request)).rejects.toMatchObject({ code: ProviderRegistryErrorCode.RefusedNoCredential })
    })

    it.each([
        [TiktokErrorCode.Rejected, "rejected", "not_sent"],
        [TiktokErrorCode.NotFound, "not_found", "not_sent"],
        [TiktokErrorCode.NotConfigured, "not_available", "not_sent"],
    ])("answers %s as a refusal %s proving %s", async (code, reason, proof) => {
        const { service, client } = build()
        client.initPost.mockRejectedValue(new TiktokError({ code, params: { status: 403, word: "privacy_level_option_mismatch", detail: "d" } }))

        const failure: unknown = await service.publish(account(), request).catch((cause: unknown) => cause)
        expect(providerRefusalReason(failure)).toBe(reason)
        expect(proofOf(failure)).toBe(proof)
    })

    it.each([
        [TiktokErrorCode.Unreachable, "unknown"],
        [TiktokErrorCode.Failed, "unknown"],
        [TiktokErrorCode.Malformed, "unknown"],
        [TiktokErrorCode.RateLimited, "not_sent"],
    ])("rethrows %s as it is, proving %s", async (code, proof) => {
        const { service, client } = build()
        const error = new TiktokError({ code, params: { status: 500, word: "", detail: "" } })
        client.initPost.mockRejectedValue(error)

        const failure: unknown = await service.publish(account(), request).catch((cause: unknown) => cause)
        expect(failure).toBe(error)
        expect(proofOf(failure)).toBe(proof)
    })
})

describe("TiktokVideoService > status and creator", () => {
    it("maps TikTok's status words to pending, published, failed", () => {
        expect(publishStateOf("PROCESSING_UPLOAD")).toBe("pending")
        expect(publishStateOf("PROCESSING_DOWNLOAD")).toBe("pending")
        expect(publishStateOf("SEND_TO_USER_INBOX")).toBe("pending")
        expect(publishStateOf("PUBLISH_COMPLETE")).toBe("published")
        expect(publishStateOf("FAILED")).toBe("failed")
    })

    it("answers the post as it stands", async () => {
        const { service, client } = build()
        client.status.mockResolvedValue({ status: "FAILED", failReason: "file_format_check_failed", postIds: [], uploadedBytes: null, downloadedBytes: null })

        await expect(service.status(account(), "p1")).resolves.toEqual({
            publishId: "p1",
            state: "failed",
            providerStatus: "FAILED",
            failReason: "file_format_check_failed",
            postIds: [],
        })
    })

    it("answers the creator's limits", async () => {
        const { service, client } = build()
        const creator = { username: "u", nickname: "n", privacyLevelOptions: ["SELF_ONLY"], commentDisabled: false, duetDisabled: true, stitchDisabled: false, maxVideoPostDurationSec: 300 }
        client.creatorInfo.mockResolvedValue(creator)

        await expect(service.creator(account())).resolves.toEqual(creator)
    })
})
