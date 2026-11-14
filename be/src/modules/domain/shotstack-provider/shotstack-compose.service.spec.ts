import { mock } from "@starci/jest-preset"
import type { ConnectionsService } from "@modules/domain/connections"
import { proofOf, providerRefusalDetail, ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import { ShotstackError, ShotstackErrorCode } from "@modules/integrations/shotstack"
import type { ShotstackClient } from "@modules/integrations/shotstack"
import { SOUND_SPEC } from "@tests/fixtures/builders/video-compose.builder"
import {
    SHOTSTACK_RENDER_ID,
    SHOTSTACK_WEBHOOK_DONE,
    shotstackAccountOf,
} from "@tests/fixtures/builders/shotstack.builder"
import { ShotstackComposeService } from "./shotstack-compose.service"
import { ShotstackCredentialService } from "./shotstack-credential.service"
import { shotstackEditOf } from "./shotstack-timeline.policy"

const KEY = ["test", "key"].join("-")

const build = () => {
    const connections = mock<ConnectionsService>()
    connections.readSecret.mockResolvedValue({ plain: JSON.stringify({ apiKey: KEY }), webhookSecret: "hook" })
    const client = mock<ShotstackClient>()
    return { service: new ShotstackComposeService(client, new ShotstackCredentialService(connections)), client, connections }
}

const failure = async (work: Promise<unknown>): Promise<unknown> => work.then(() => undefined, (cause: unknown) => cause)

describe("ShotstackComposeService > start", () => {
    it("sends the mapped Edit with the callback to the account's environment and answers the render id", async () => {
        const { service, client } = build()
        client.render.mockResolvedValue({ id: SHOTSTACK_RENDER_ID })
        const callback = { url: "https://nivo.test/api/connections/video-render/shotstack/c1/secret" }

        await expect(service.start(shotstackAccountOf("v1"), SOUND_SPEC, callback)).resolves.toEqual({ renderId: SHOTSTACK_RENDER_ID })
        expect(client.render).toHaveBeenCalledWith(KEY, "v1", shotstackEditOf(SOUND_SPEC, callback.url))
    })

    it("sends no callback when there is none, and renders on the sandbox when the account names no environment", async () => {
        const { service, client } = build()
        client.render.mockResolvedValue({ id: SHOTSTACK_RENDER_ID })

        await service.start(shotstackAccountOf(null), SOUND_SPEC, null)

        expect(client.render).toHaveBeenCalledWith(KEY, "stage", shotstackEditOf(SOUND_SPEC, null))
    })

    it("refuses a spec the sandbox cannot render before anything is read or sent: rejected, proved not_sent", async () => {
        const { service, client, connections } = build()
        const spec = { ...SOUND_SPEC, clips: [{ fileUrl: "https://store.test/a.mp4", trimMs: { fromMs: 0, toMs: 600_000 } }, { fileUrl: "https://store.test/b.mp4", trimMs: { fromMs: 0, toMs: 1000 } }] }

        const thrown = await failure(service.start(shotstackAccountOf("stage"), spec, null))

        expect(thrown).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected })
        expect(providerRefusalDetail(thrown)).toContain("clips")
        expect(proofOf(thrown)).toBe("not_sent")
        expect(client.render).not.toHaveBeenCalled()
        expect(connections.readSecret).not.toHaveBeenCalled()
    })

    it("sends nothing without a key: no_credential, proved not_sent", async () => {
        const { service, client, connections } = build()
        connections.readSecret.mockResolvedValue(null)

        const thrown = await failure(service.start(shotstackAccountOf(), SOUND_SPEC, null))

        expect(thrown).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNoCredential })
        expect(proofOf(thrown)).toBe("not_sent")
        expect(client.render).not.toHaveBeenCalled()
    })

    it("turns Shotstack's refusal into a provider refusal carrying its words", async () => {
        const { service, client } = build()
        client.render.mockRejectedValue(new ShotstackError({ code: ShotstackErrorCode.Rejected, params: { status: 400, detail: "Bad Request" } }))

        const thrown = await failure(service.start(shotstackAccountOf(), SOUND_SPEC, null))

        expect(thrown).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected, params: { detail: "Bad Request" } })
        expect(proofOf(thrown)).toBe("not_sent")
    })

    it("proves a 5xx unknown: the render may have started", async () => {
        const { service, client } = build()
        client.render.mockRejectedValue(new ShotstackError({ code: ShotstackErrorCode.Failed, params: { status: 502, detail: "" } }))

        expect(proofOf(await failure(service.start(shotstackAccountOf(), SOUND_SPEC, null)))).toBe("unknown")
    })
})

describe("ShotstackComposeService > statusOf", () => {
    it("answers a running render with the neutral status and no output", async () => {
        const { service, client } = build()
        client.renderStatus.mockResolvedValue({ id: SHOTSTACK_RENDER_ID, status: "saving", url: null, error: null })

        await expect(service.statusOf(shotstackAccountOf("v1"), SHOTSTACK_RENDER_ID)).resolves.toEqual({ renderId: SHOTSTACK_RENDER_ID, status: "rendering" })
        expect(client.renderStatus).toHaveBeenCalledWith(KEY, "v1", SHOTSTACK_RENDER_ID)
    })

    it("answers a done render with its address", async () => {
        const { service, client } = build()
        client.renderStatus.mockResolvedValue({ id: SHOTSTACK_RENDER_ID, status: "done", url: SHOTSTACK_WEBHOOK_DONE.url, error: null })

        await expect(service.statusOf(shotstackAccountOf(), SHOTSTACK_RENDER_ID)).resolves.toEqual({
            renderId: SHOTSTACK_RENDER_ID,
            status: "done",
            outputUrl: SHOTSTACK_WEBHOOK_DONE.url,
        })
    })

    it("answers a failed render with Shotstack's reason", async () => {
        const { service, client } = build()
        client.renderStatus.mockResolvedValue({ id: SHOTSTACK_RENDER_ID, status: "failed", url: null, error: "bad asset" })

        await expect(service.statusOf(shotstackAccountOf(), SHOTSTACK_RENDER_ID)).resolves.toEqual({
            renderId: SHOTSTACK_RENDER_ID,
            status: "failed",
            error: "bad asset",
        })
    })

    it("treats a done render with no address as unreadable, proved unknown", async () => {
        const { service, client } = build()
        client.renderStatus.mockResolvedValue({ id: SHOTSTACK_RENDER_ID, status: "done", url: null, error: null })

        expect(proofOf(await failure(service.statusOf(shotstackAccountOf(), SHOTSTACK_RENDER_ID)))).toBe("unknown")
    })

    it("refuses an unknown render as not_found", async () => {
        const { service, client } = build()
        client.renderStatus.mockRejectedValue(new ShotstackError({ code: ShotstackErrorCode.NotFound, params: { status: 404, detail: "" } }))

        expect(await failure(service.statusOf(shotstackAccountOf(), SHOTSTACK_RENDER_ID))).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNotFound })
    })
})

describe("ShotstackComposeService > webhook", () => {
    it("signs nothing, so every delivery the door let in is proven", () => {
        const { service } = build()

        expect(service.webhook).toEqual({ signatureHeader: null, timestampHeader: null })
        expect(service.proves({ rawBody: Buffer.from("{}"), signature: undefined, timestamp: undefined })).toBe(true)
    })

    it("maps a callback body through the pure completion", () => {
        const { service } = build()

        expect(service.completionOf(SHOTSTACK_WEBHOOK_DONE)).toMatchObject({ status: "done" })
        expect(service.completionOf({ ...SHOTSTACK_WEBHOOK_DONE, status: "queued" })).toBeNull()
    })
})
