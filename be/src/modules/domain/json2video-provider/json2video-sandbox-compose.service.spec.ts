import { readFileSync } from "node:fs"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { SOUND_SPEC } from "@tests/fixtures/builders/video-compose.builder"
import { proofOf, ProviderRegistryErrorCode, providerRefusalDetail, providerRefusalReason } from "@modules/domain/provider-registry"
import { ProviderSandboxError, ProviderSandboxErrorCode, type SandboxCase } from "@modules/domain/provider-sandbox"
import type { ComposeSpec } from "@modules/domain/video-compose"
import {
    JSON2VIDEO_SANDBOX_CATALOGUE,
    JSON2VIDEO_SANDBOX_CLIPS,
    JSON2VIDEO_SANDBOX_FAILED_MESSAGE,
    JSON2VIDEO_SANDBOX_NOT_FOUND_MESSAGE,
    JSON2VIDEO_SANDBOX_NO_CREDITS_MESSAGE,
    JSON2VIDEO_SANDBOX_OUTPUT_URL,
} from "./json2video-sandbox.catalogue"
import { Json2VideoSandboxComposeService } from "./json2video-sandbox-compose.service"

const account = sandboxAccount({ provider: "json2video" })
const connection = connectionRecord({ provider: "json2video", id: account.id, workspaceId: account.workspaceId, sandbox: true })

const build = () => {
    const { sandbox } = sandboxServiceOf(account)
    return { sandbox, service: new Json2VideoSandboxComposeService(sandbox) }
}

/** The spec of the sound fixture with its first clip replaced by the clip a case names. */
const specOf = (clipUrl: string): ComposeSpec => ({ ...SOUND_SPEC, clips: [{ fileUrl: clipUrl }, ...SOUND_SPEC.clips.slice(1)] })

const AT = new Date("2026-11-14T03:00:00.000Z")

/** The webhook body a catalogue case builds from its default input (R62: the case's transformation, through the sandbox's own inbound send). */
const bodyOf = async (sandbox: ReturnType<typeof build>["sandbox"], one: SandboxCase | undefined): Promise<unknown> => {
    if (one?.inbound === undefined) throw new Error("not an inbound case")
    const events = await sandbox.inbound(account, one.id, one.inbound, Object.fromEntries(one.inbound.inputs.map((field) => [field.name, field.example])), AT)
    expect(events).toHaveLength(1)
    return events[0]?.body
}

const failure = (work: Promise<unknown>): Promise<unknown> => Promise.resolve(work.then(() => undefined, (cause: unknown) => cause))

describe("Json2VideoSandboxComposeService > start and status", () => {
    it("JSON2VIDEO-1: accepts a render, then reads queued, rendering, done with the video address, and holds done", async () => {
        const { sandbox, service } = build()

        const started = await service.start(connection, specOf(JSON2VIDEO_SANDBOX_CLIPS.completes), { url: "https://hooks.test/x" })

        expect(started).toEqual({ renderId: "SBX-JSON2VIDEO-000001" })
        const polls = [
            await service.statusOf(connection, started.renderId),
            await service.statusOf(connection, started.renderId),
            await service.statusOf(connection, started.renderId),
            await service.statusOf(connection, started.renderId),
        ]
        expect(polls).toEqual([
            { renderId: started.renderId, status: "queued" },
            { renderId: started.renderId, status: "rendering" },
            { renderId: started.renderId, status: "done", outputUrl: JSON2VIDEO_SANDBOX_OUTPUT_URL },
            { renderId: started.renderId, status: "done", outputUrl: JSON2VIDEO_SANDBOX_OUTPUT_URL },
        ])
        expect(await sandbox.calls(account, "start")).toHaveLength(1)
        expect(await sandbox.calls(account, "statusOf")).toHaveLength(4)
    })

    it("takes the default case (a render that completes) for a first clip the catalogue does not name, with the next running id", async () => {
        const { service } = build()

        await service.start(connection, SOUND_SPEC, null)
        const second = await service.start(connection, SOUND_SPEC, null)

        expect(second).toEqual({ renderId: "SBX-JSON2VIDEO-000002" })
        await service.statusOf(connection, second.renderId)
        await service.statusOf(connection, second.renderId)
        await expect(service.statusOf(connection, second.renderId)).resolves.toMatchObject({ status: "done" })
    })

    it("JSON2VIDEO-2: a render that later fails ends at failed with the provider's words", async () => {
        const { service } = build()
        const { renderId } = await service.start(connection, specOf(JSON2VIDEO_SANDBOX_CLIPS.fails), null)

        await service.statusOf(connection, renderId)
        await service.statusOf(connection, renderId)

        await expect(service.statusOf(connection, renderId)).resolves.toEqual({ renderId, status: "failed", error: JSON2VIDEO_SANDBOX_FAILED_MESSAGE })
    })

    it("JSON2VIDEO-3: a render refused for no credits is the live refusal (rejected, not_sent, the hint) and starts nothing", async () => {
        const { sandbox, service } = build()

        const cause = await failure(service.start(connection, specOf(JSON2VIDEO_SANDBOX_CLIPS.noCredits), null))

        expect(providerRefusalReason(cause)).toBe("rejected")
        expect(providerRefusalDetail(cause)).toBe(JSON2VIDEO_SANDBOX_NO_CREDITS_MESSAGE)
        expect(proofOf(cause)).toBe("not_sent")
        const next = await service.start(connection, SOUND_SPEC, null)
        expect(next.renderId).toBe("SBX-JSON2VIDEO-000002")
        await expect(failure(service.statusOf(connection, "SBX-JSON2VIDEO-000001"))).resolves.toMatchObject({ code: ProviderRegistryErrorCode.RefusedNotFound })
        expect((await sandbox.calls(account, "start"))[0]?.result).toEqual({ outcome: "threw", error: ProviderRegistryErrorCode.RefusedRejected })
    })

    it("JSON2VIDEO-4: an unknown outcome throws the unknown proof AFTER the render exists, so its status can be read", async () => {
        const { service } = build()

        const cause = await failure(service.start(connection, specOf(JSON2VIDEO_SANDBOX_CLIPS.serverError), null))

        expect(proofOf(cause)).toBe("unknown")
        await expect(service.statusOf(connection, "SBX-JSON2VIDEO-000001")).resolves.toEqual({ renderId: "SBX-JSON2VIDEO-000001", status: "queued" })
    })

    it("refuses a movie JSON over 2 MB as the live does (rejected, not_sent), before any case", async () => {
        const { service } = build()
        const huge = { url: `https://hooks.test/${"z".repeat(2_097_152)}` }

        const cause = await failure(service.start(connection, SOUND_SPEC, huge))

        expect(providerRefusalReason(cause)).toBe("rejected")
        expect(providerRefusalDetail(cause)).toContain("2097152 bytes")
        expect(proofOf(cause)).toBe("not_sent")
    })

    it("JSON2VIDEO-5: a status read of a render the account does not hold is the not_found refusal", async () => {
        const { service } = build()

        const cause = await failure(service.statusOf(connection, "SBX-JSON2VIDEO-000009"))

        expect(providerRefusalReason(cause)).toBe("not_found")
        expect(providerRefusalDetail(cause)).toBe(JSON2VIDEO_SANDBOX_NOT_FOUND_MESSAGE)
        expect(proofOf(cause)).toBe("not_sent")
    })

    it("is deterministic: two fresh accounts answer the same ids and statuses", async () => {
        const answers = async (): Promise<unknown> => {
            const { service } = build()
            const { renderId } = await service.start(connection, SOUND_SPEC, null)
            return [renderId, await service.statusOf(connection, renderId), await service.statusOf(connection, renderId)]
        }

        expect(await answers()).toEqual(await answers())
    })

    it("keeps each account's renders apart", async () => {
        const other = sandboxAccount({ provider: "json2video", id: "sbx-conn-2" })
        const { sandbox } = sandboxServiceOf(account, other)
        const service = new Json2VideoSandboxComposeService(sandbox)
        const otherConnection = connectionRecord({ provider: "json2video", id: other.id, workspaceId: other.workspaceId, sandbox: true })
        await service.start(connection, SOUND_SPEC, null)

        await expect(service.start(otherConnection, SOUND_SPEC, null)).resolves.toEqual({ renderId: "SBX-JSON2VIDEO-000001" })
    })
})

describe("Json2VideoSandboxComposeService > the webhook, the frame and the law", () => {
    it("maps the webhook cases with the live completion mapper and gives the provider's real route", async () => {
        const { sandbox, service } = build()
        const inbound = JSON2VIDEO_SANDBOX_CATALOGUE.cases.filter((one) => one.inbound !== undefined)

        expect(inbound.map((one) => one.id)).toEqual(["JSON2VIDEO-6", "JSON2VIDEO-7", "JSON2VIDEO-8"])
        expect(service.completionOf(await bodyOf(sandbox, inbound[0]))).toEqual({ renderId: "SBX-JSON2VIDEO-000001", status: "done", outputUrl: JSON2VIDEO_SANDBOX_OUTPUT_URL })
        expect(service.completionOf(await bodyOf(sandbox, inbound[1]))).toEqual({
            renderId: "SBX-JSON2VIDEO-000002",
            status: "failed",
            error: JSON2VIDEO_SANDBOX_FAILED_MESSAGE,
        })
        expect(service.completionOf(await bodyOf(sandbox, inbound[2]))).toBeNull()
        for (const one of inbound) {
            expect(one.inbound?.path("c-9")).toBe("api/connections/video-render/json2video/c-9/sandbox")
            expect(one.inbound?.trigger).toBe("render.completed")
        }
        expect(service.proves()).toBe(true)
        expect(service.webhook).toEqual({ signatureHeader: null, timestampHeader: null })
    })

    it("has unique ids of the form JSON2VIDEO-<n>", () => {
        const ids = JSON2VIDEO_SANDBOX_CATALOGUE.cases.map((one) => one.id)

        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.every((id) => /^JSON2VIDEO-\d+$/.test(id))).toBe(true)
        expect(JSON2VIDEO_SANDBOX_CATALOGUE.provider).toBe("json2video")
    })

    it("refuses a live account (PROVIDER_SANDBOX_LIVE_ACCOUNT)", async () => {
        const live = sandboxAccount({ provider: "json2video", id: "live-1", sandbox: false })
        const { sandbox } = sandboxServiceOf(live)
        const service = new Json2VideoSandboxComposeService(sandbox)

        const cause = await failure(service.start(connectionRecord({ provider: "json2video", id: live.id }), SOUND_SPEC, null))

        expect(cause).toBeInstanceOf(ProviderSandboxError)
        expect(cause).toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
    })

    it("is refused with the switch off (PROVIDER_SANDBOX_OFF)", async () => {
        const { sandbox } = sandboxServiceOff(account)
        const service = new Json2VideoSandboxComposeService(sandbox)

        await expect(failure(service.statusOf(connection, "x"))).resolves.toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("reaches no network: one constructor argument and no client or host in its source", () => {
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")

        expect(Json2VideoSandboxComposeService.length).toBe(1)
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})
