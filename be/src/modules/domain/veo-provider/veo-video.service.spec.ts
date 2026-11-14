import { mock } from "@starci/jest-preset"
import type { ConnectionRecord, ConnectionsService } from "@modules/domain/connections"
import { proofOf, ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import type { VideoRequest } from "@modules/domain/provider-registry"
import { VeoError, VeoErrorCode } from "@modules/integrations/veo"
import type { VeoClient } from "@modules/integrations/veo"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { VeoCredentialService } from "./veo-credential.service"
import { VeoVideoService } from "./veo-video.service"

const KEY = ["test", "key"].join("-")
const OPERATION = "models/veo-3.1-generate-preview/operations/abc123"
const URI = "https://generativelanguage.googleapis.com/v1beta/files/xyz:download?alt=media"

const account = (meta: Record<string, string> = { model: "veo-3.1-generate-preview" }): ConnectionRecord =>
    connectionRecord({ id: "conn-v", workspaceId: "ws-1", provider: "veo", name: "Video", meta })

const request: VideoRequest = {
    prompt: "A lotus pond",
    image: null,
    modelId: null,
    aspectRatio: "16:9",
    resolution: null,
    durationSeconds: "8",
    personGeneration: null,
    seed: null,
}

const build = () => {
    const connections = mock<ConnectionsService>()
    connections.readSecret.mockResolvedValue({ plain: JSON.stringify({ apiKey: KEY }), webhookSecret: "hook" })
    const client = mock<VeoClient>()
    return { service: new VeoVideoService(client, new VeoCredentialService(connections)), client }
}

const failure = (work: Promise<unknown>): Promise<unknown> => Promise.resolve(work.then(() => undefined, (cause: unknown) => cause))

describe("VeoVideoService > start", () => {
    it("generates with the account's model and answers the operation name as the job", async () => {
        const { service, client } = build()
        client.generate.mockResolvedValue({ name: OPERATION, done: false, error: null, videoUris: [] })

        await expect(service.start(account(), request)).resolves.toEqual({ jobId: OPERATION, modelId: "veo-3.1-generate-preview" })
        expect(client.generate).toHaveBeenCalledWith(KEY, {
            model: "veo-3.1-generate-preview",
            prompt: "A lotus pond",
            image: null,
            aspectRatio: "16:9",
            resolution: null,
            durationSeconds: "8",
            personGeneration: null,
            seed: null,
        })
    })

    it("takes the model the request names over the account's own", async () => {
        const { service, client } = build()
        client.generate.mockResolvedValue({ name: OPERATION, done: false, error: null, videoUris: [] })

        await service.start(account(), { ...request, modelId: "veo-3.0-generate-001" })

        expect(client.generate.mock.calls[0]?.[1].model).toBe("veo-3.0-generate-001")
    })

    it("sends nothing without a model: rejected, proved not_sent", async () => {
        const { service, client } = build()

        const thrown = await failure(service.start(account({}), request))

        expect(thrown).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected })
        expect(proofOf(thrown)).toBe("not_sent")
        expect(client.generate).not.toHaveBeenCalled()
    })

    it.each([
        [VeoErrorCode.Rejected, "not_sent"],
        [VeoErrorCode.AuthFailed, "not_sent"],
        [VeoErrorCode.RateLimited, "not_sent"],
        [VeoErrorCode.Failed, "unknown"],
        [VeoErrorCode.Unreachable, "unknown"],
    ])("proves %s %s", async (code, proof) => {
        const { service, client } = build()
        client.generate.mockRejectedValue(new VeoError({ code }))

        expect(proofOf(await failure(service.start(account(), request)))).toBe(proof)
    })
})

describe("VeoVideoService > poll (pending, done, failed)", () => {
    it.each([
        ["pending", { name: OPERATION, done: false, error: null, videoUris: [] }, 0],
        ["done", { name: OPERATION, done: true, error: null, videoUris: [URI] }, 1],
        ["failed", { name: OPERATION, done: true, error: { code: 3, message: "refused" }, videoUris: [] }, 0],
    ] as const)("reads a %s generation", async (state, operation, files) => {
        const { service, client } = build()
        client.operation.mockResolvedValue(operation)

        const job = await service.get(account(), OPERATION)

        expect(job).toMatchObject({ jobId: OPERATION, state, error: operation.error })
        expect(job.files).toHaveLength(files)
    })

    it("answers each video as a file reopened by its URI, read on fetch only", async () => {
        const { service, client } = build()
        client.operation.mockResolvedValue({ name: OPERATION, done: true, error: null, videoUris: [URI] })
        client.download.mockResolvedValue({ bytes: Buffer.from("mp4"), contentType: "video/mp4" })

        const [file] = (await service.get(account(), OPERATION)).files

        expect(file).toMatchObject({ provider: "veo", handle: URI, mimeType: "video/mp4" })
        expect(client.download).not.toHaveBeenCalled()
        await expect(file?.fetch()).resolves.toEqual(Buffer.from("mp4"))
        expect(client.download).toHaveBeenCalledWith(KEY, URI)
    })
})
