import { mock } from "@starci/jest-preset"
import type { ConnectionRecord, ConnectionsService, Provider } from "@modules/domain/connections"
import { proofOf, providerRefusalDetail, providerRefusalReason, ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import { ElevenlabsError, ElevenlabsErrorCode } from "@modules/integrations/elevenlabs"
import type { ElevenLabsClient } from "@modules/integrations/elevenlabs"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { ElevenLabsCredentialService, elevenLabsKeyOf } from "./elevenlabs-credential.service"
import { dubbedHandleOf, ElevenLabsMediaService } from "./elevenlabs-media.service"

const KEY = ["test", "key"].join("-")

const account = (provider: Provider = "elevenlabs"): ConnectionRecord =>
    connectionRecord({ id: "conn-1", workspaceId: "ws-1", provider, name: "Voice", meta: {} })

const build = (plain: string | null = JSON.stringify({ apiKey: KEY })) => {
    const connections = mock<ConnectionsService>()
    connections.readSecret.mockResolvedValue(plain === null ? null : { plain, webhookSecret: "hook" })
    const client = mock<ElevenLabsClient>()
    const service = new ElevenLabsMediaService(client, new ElevenLabsCredentialService(connections))
    return { service, client, connections }
}

const failure = async (work: Promise<unknown>): Promise<unknown> => work.then(() => undefined, (cause: unknown) => cause)

describe("ElevenLabsMediaService > the account's credential", () => {
    it("reads the API key of the sealed secret", () => {
        expect(elevenLabsKeyOf(JSON.stringify({ apiKey: " k " }))).toBe("k")
        expect(elevenLabsKeyOf("not json")).toBeNull()
        expect(elevenLabsKeyOf(JSON.stringify({ other: "x" }))).toBeNull()
    })

    it.each<[string, string | null, Provider]>([
        ["an account with no secret", null, "elevenlabs"],
        ["a secret without a key", JSON.stringify({}), "elevenlabs"],
        ["an account of another provider", JSON.stringify({ apiKey: KEY }), "google"],
    ])("sends nothing for %s: no_credential, proved not_sent", async (_name, plain, provider) => {
        const { service, client } = build(plain)

        const thrown = await failure(service.voices(account(provider), { search: null, pageSize: 10, pageToken: null }))

        expect(thrown).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNoCredential })
        expect(proofOf(thrown)).toBe("not_sent")
        expect(client.searchVoices).not.toHaveBeenCalled()
    })
})

describe("ElevenLabsMediaService > speech", () => {
    it("maps a synthesis onto the convert and answers the clip as a file held in memory", async () => {
        const { service, client } = build()
        const bytes = Buffer.from("mp3")
        client.convert.mockResolvedValue({ bytes, contentType: "audio/mpeg" })

        const clip = await service.synthesize(account(), {
            text: "Ch\u00e0o",
            voiceId: "v-1",
            modelId: null,
            languageCode: "vi",
            format: "mp3_44100_128",
            seed: null,
        })

        expect(client.convert).toHaveBeenCalledWith(KEY, {
            voiceId: "v-1",
            text: "Ch\u00e0o",
            modelId: null,
            languageCode: "vi",
            seed: null,
            outputFormat: "mp3_44100_128",
        })
        expect(clip).toMatchObject({ provider: "elevenlabs", mimeType: "audio/mpeg", expiresAt: null })
        expect(clip.handle).toMatch(/^speech\/[0-9a-f]{64}$/u)
        await expect(clip.fetch()).resolves.toBe(bytes)
    })

    it("answers only the next page token while the provider says there are more", async () => {
        const { service, client } = build()
        client.searchVoices.mockResolvedValue({ voices: [], hasMore: false, nextPageToken: "stale" })

        await expect(service.voices(account(), { search: null, pageSize: 10, pageToken: null })).resolves.toEqual({
            voices: [],
            nextPageToken: null,
        })
    })
})

describe("ElevenLabsMediaService > the failures, with what they prove", () => {
    it.each([
        [ElevenlabsErrorCode.AuthFailed, "auth_refused", "not_sent"],
        [ElevenlabsErrorCode.NotFound, "not_found", "not_sent"],
        [ElevenlabsErrorCode.Rejected, "rejected", "not_sent"],
    ])("answers %s as the refusal %s, proved %s", async (code, reason, proof) => {
        const { service, client } = build()
        client.createDubbing.mockRejectedValue(new ElevenlabsError({ code, params: { status: 400, detail: "words" } }))

        const thrown = await failure(
            service.create(account(), { sourceUrl: "https://a.test/v.mp4", targetLanguage: "vi", sourceLanguage: null, name: null, speakers: null, watermark: null }),
        )

        expect(providerRefusalReason(thrown)).toBe(reason)
        expect(providerRefusalDetail(thrown)).toBe("words")
        expect(proofOf(thrown)).toBe(proof)
    })

    it.each([
        [ElevenlabsErrorCode.Unreachable, "unknown"],
        [ElevenlabsErrorCode.Failed, "unknown"],
        [ElevenlabsErrorCode.Malformed, "unknown"],
        [ElevenlabsErrorCode.RateLimited, "not_sent"],
    ])("rethrows %s as it is, proved %s", async (code, proof) => {
        const { service, client } = build()
        const cause = new ElevenlabsError({ code })
        client.convert.mockRejectedValue(cause)

        const thrown = await failure(
            service.synthesize(account(), { text: "x", voiceId: "v", modelId: null, languageCode: null, format: null, seed: null }),
        )

        expect(thrown).toBe(cause)
        expect(proofOf(thrown)).toBe(proof)
    })
})

describe("ElevenLabsMediaService > dubbing: create, then poll (pending, done, failed)", () => {
    const dub = { dubbingId: "d-1", name: "Clip", targetLanguages: ["es", "fr"] }

    it("starts a job and answers its id and expected seconds", async () => {
        const { service, client } = build()
        client.createDubbing.mockResolvedValue({ dubbingId: "d-1", expectedDurationSec: 127.5 })

        await expect(
            service.create(account(), { sourceUrl: "https://a.test/v.mp4", targetLanguage: "es", sourceLanguage: null, name: "Clip", speakers: 0, watermark: false }),
        ).resolves.toEqual({ jobId: "d-1", expectedSeconds: 127.5 })
        expect(client.createDubbing).toHaveBeenCalledWith(KEY, {
            sourceUrl: "https://a.test/v.mp4",
            targetLang: "es",
            sourceLang: null,
            name: "Clip",
            numSpeakers: 0,
            watermark: false,
        })
    })

    it.each([
        ["pending", { ...dub, status: "dubbing", error: null }, 0],
        ["done", { ...dub, status: "dubbed", error: null }, 2],
        ["failed", { ...dub, status: "failed", error: "Source unreadable" }, 0],
    ] as const)("reads a %s job", async (state, read, files) => {
        const { service, client } = build()
        client.getDubbing.mockResolvedValue(read)

        const job = await service.get(account(), "d-1")

        expect(job).toMatchObject({ jobId: "d-1", state, providerStatus: read.status, error: read.error })
        expect(job.files).toHaveLength(files)
    })

    it("reopens a dubbed language by its handle and reads it on fetch only", async () => {
        const { service, client } = build()
        client.dubbedFile.mockResolvedValue({ bytes: Buffer.from("mp4"), contentType: "video/mp4" })

        const file = service.open(account(), dubbedHandleOf("d-1", "es"))

        expect(client.dubbedFile).not.toHaveBeenCalled()
        await expect(file.fetch()).resolves.toEqual(Buffer.from("mp4"))
        expect(client.dubbedFile).toHaveBeenCalledWith(KEY, "d-1", "es")
    })

    it("refuses to reopen a handle it never answered (a speech clip, a stranger)", async () => {
        const { service, client } = build()

        await expect(service.open(account(), "speech/abc").fetch()).rejects.toMatchObject({ code: ProviderRegistryErrorCode.RefusedNotFound })
        await expect(service.open(account(), "dubbing/d-1/es/extra").fetch()).rejects.toMatchObject({ code: ProviderRegistryErrorCode.RefusedNotFound })
        expect(client.dubbedFile).not.toHaveBeenCalled()
    })
})
