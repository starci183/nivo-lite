import { readFileSync } from "node:fs"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import {
    proofOf,
    ProviderRegistryErrorCode,
    providerRefusalDetail,
    providerRefusalReason,
    type VideoRequest,
} from "@modules/domain/provider-registry"
import { ProviderSandboxError, ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import {
    VEO_SANDBOX_CATALOGUE,
    VEO_SANDBOX_FAILED_ERROR,
    VEO_SANDBOX_FILE_NOT_FOUND_MESSAGE,
    VEO_SANDBOX_JOB_NOT_FOUND_MESSAGE,
    VEO_SANDBOX_NO_MODEL_DETAIL,
    VEO_SANDBOX_PROMPTS,
    VEO_SANDBOX_REJECTED_MESSAGE,
    VEO_SANDBOX_VIDEO_MIME,
    veoSandboxVideoBytesOf,
} from "./veo-sandbox.catalogue"
import { VeoSandboxVideoService } from "./veo-sandbox-video.service"

const MODEL = "veo-3.0-generate-001"
const account = sandboxAccount({ provider: "veo" })
const connection = connectionRecord({ provider: "veo", id: account.id, workspaceId: account.workspaceId, sandbox: true, meta: { model: MODEL } })
const bareConnection = connectionRecord({ provider: "veo", id: account.id, workspaceId: account.workspaceId, sandbox: true })

const build = () => {
    const { sandbox } = sandboxServiceOf(account)
    return { sandbox, service: new VeoSandboxVideoService(sandbox) }
}

const requestOf = (prompt: string, modelId: string | null = null): VideoRequest => ({
    prompt,
    image: null,
    modelId,
    aspectRatio: null,
    resolution: null,
    durationSeconds: null,
    personGeneration: null,
    seed: null,
})

const failure = (work: Promise<unknown>): Promise<unknown> => Promise.resolve(work.then(() => undefined, (cause: unknown) => cause))

describe("VeoSandboxVideoService > generation and files", () => {
    it("VEO-1 and 8: accepts a generation (the account's model), reads pending twice then done with one video that reopens with fixed bytes", async () => {
        const { sandbox, service } = build()

        const started = await service.start(connection, requestOf(VEO_SANDBOX_PROMPTS.completes))
        const reads = [await service.get(connection, started.jobId), await service.get(connection, started.jobId), await service.get(connection, started.jobId)]

        expect(started).toEqual({ jobId: `models/${MODEL}/operations/SBX-VEO-000001`, modelId: MODEL })
        expect(reads[0]).toEqual({ jobId: started.jobId, state: "pending", error: null, files: [] })
        expect(reads[1]?.state).toBe("pending")
        const done = reads[2]
        const uri = "https://sandbox.nivo.test/veo/files/SBX-VEO-000001.mp4"
        expect(done).toMatchObject({ state: "done", error: null })
        expect(done?.files.map((file) => [file.handle, file.mimeType])).toEqual([[uri, VEO_SANDBOX_VIDEO_MIME]])
        await expect(done?.files[0]?.fetch()).resolves.toEqual(veoSandboxVideoBytesOf(uri))
        await expect(service.open(connection, uri).fetch()).resolves.toEqual(veoSandboxVideoBytesOf(uri))
        expect(await sandbox.calls(account, "start")).toHaveLength(1)
        expect(await sandbox.calls(account, "get")).toHaveLength(3)
        expect(await sandbox.calls(account, "file")).toHaveLength(2)
    })

    it("takes the request's model before the account's, and the first case for a prompt the catalogue does not name", async () => {
        const { service } = build()

        const first = await service.start(connection, requestOf("a prompt the catalogue never named", "veo-2.0"))
        const second = await service.start(connection, requestOf(VEO_SANDBOX_PROMPTS.completes))

        expect(first).toEqual({ jobId: "models/veo-2.0/operations/SBX-VEO-000001", modelId: "veo-2.0" })
        expect(second.jobId).toBe(`models/${MODEL}/operations/SBX-VEO-000002`)
    })

    it("VEO-2: a generation that later fails ends failed with Google's code and words", async () => {
        const { service } = build()
        const { jobId } = await service.start(connection, requestOf(VEO_SANDBOX_PROMPTS.fails))

        await service.get(connection, jobId)
        await service.get(connection, jobId)

        await expect(service.get(connection, jobId)).resolves.toEqual({ jobId, state: "failed", error: VEO_SANDBOX_FAILED_ERROR, files: [] })
    })

    it("VEO-3: a generation the filters block ends done with no video", async () => {
        const { service } = build()
        const { jobId } = await service.start(connection, requestOf(VEO_SANDBOX_PROMPTS.blocked))

        await service.get(connection, jobId)
        await service.get(connection, jobId)

        await expect(service.get(connection, jobId)).resolves.toEqual({ jobId, state: "done", error: null, files: [] })
    })

    it("VEO-4: a prompt refused at start is the live refusal (rejected, not_sent) and starts nothing", async () => {
        const { service } = build()

        const cause = await failure(service.start(connection, requestOf(VEO_SANDBOX_PROMPTS.refused)))

        expect(providerRefusalReason(cause)).toBe("rejected")
        expect(providerRefusalDetail(cause)).toBe(VEO_SANDBOX_REJECTED_MESSAGE)
        expect(proofOf(cause)).toBe("not_sent")
        const next = await service.start(connection, requestOf(VEO_SANDBOX_PROMPTS.completes))
        expect(next.jobId).toBe(`models/${MODEL}/operations/SBX-VEO-000002`)
        await expect(failure(service.get(connection, `models/${MODEL}/operations/SBX-VEO-000001`))).resolves.toMatchObject({
            code: ProviderRegistryErrorCode.RefusedNotFound,
        })
    })

    it("VEO-5: an unknown outcome throws the unknown proof AFTER the operation exists", async () => {
        const { service } = build()

        const cause = await failure(service.start(connection, requestOf(VEO_SANDBOX_PROMPTS.serverError)))

        expect(proofOf(cause)).toBe("unknown")
        await expect(service.get(connection, `models/${MODEL}/operations/SBX-VEO-000001`)).resolves.toMatchObject({ state: "pending" })
    })

    it("VEO-6: a start naming no model, neither the request's nor the account's, is refused rejected / not_sent", async () => {
        const { service } = build()

        const cause = await failure(service.start(bareConnection, requestOf(VEO_SANDBOX_PROMPTS.completes)))

        expect(providerRefusalReason(cause)).toBe("rejected")
        expect(providerRefusalDetail(cause)).toBe(VEO_SANDBOX_NO_MODEL_DETAIL)
        expect(proofOf(cause)).toBe("not_sent")
    })

    it("VEO-7: a read of an operation the account does not hold is the not_found refusal", async () => {
        const { service } = build()

        const cause = await failure(service.get(connection, "models/x/operations/none"))

        expect(providerRefusalReason(cause)).toBe("not_found")
        expect(providerRefusalDetail(cause)).toBe(VEO_SANDBOX_JOB_NOT_FOUND_MESSAGE)
        expect(proofOf(cause)).toBe("not_sent")
    })

    it("VEO-9: a video URI no read answered is the not_found refusal", async () => {
        const { service } = build()

        const cause = await failure(service.open(connection, "https://sandbox.nivo.test/veo/files/never.mp4").fetch())

        expect(providerRefusalReason(cause)).toBe("not_found")
        expect(providerRefusalDetail(cause)).toBe(VEO_SANDBOX_FILE_NOT_FOUND_MESSAGE)
        expect(proofOf(cause)).toBe("not_sent")
    })

    it("is deterministic: two fresh accounts answer the same names, states and bytes", async () => {
        const answers = async (): Promise<string> => {
            const { service } = build()
            const { jobId } = await service.start(connection, requestOf(VEO_SANDBOX_PROMPTS.completes))
            await service.get(connection, jobId)
            await service.get(connection, jobId)
            const done = await service.get(connection, jobId)
            return JSON.stringify([jobId, done, await done.files[0]?.fetch()])
        }

        expect(await answers()).toBe(await answers())
    })
})

describe("VeoSandboxVideoService > the frame and the law", () => {
    it("has unique ids of the form VEO-<n>, and no inbound case (Veo is polled)", () => {
        const ids = VEO_SANDBOX_CATALOGUE.cases.map((one) => one.id)

        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.every((id) => /^VEO-\d+$/.test(id))).toBe(true)
        expect(VEO_SANDBOX_CATALOGUE.provider).toBe("veo")
        expect(VEO_SANDBOX_CATALOGUE.cases.some((one) => one.inbound !== undefined)).toBe(false)
    })

    it("refuses a live account (PROVIDER_SANDBOX_LIVE_ACCOUNT)", async () => {
        const live = sandboxAccount({ provider: "veo", id: "live-1", sandbox: false })
        const { sandbox } = sandboxServiceOf(live)
        const service = new VeoSandboxVideoService(sandbox)

        const cause = await failure(service.start(connectionRecord({ provider: "veo", id: live.id, meta: { model: MODEL } }), requestOf("x")))

        expect(cause).toBeInstanceOf(ProviderSandboxError)
        expect(cause).toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
    })

    it("is refused with the switch off (PROVIDER_SANDBOX_OFF)", async () => {
        const { sandbox } = sandboxServiceOff(account)
        const service = new VeoSandboxVideoService(sandbox)

        await expect(failure(service.get(connection, "x"))).resolves.toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("reaches no network: one constructor argument and no client or host in its source", () => {
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")

        expect(VeoSandboxVideoService.length).toBe(1)
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})
