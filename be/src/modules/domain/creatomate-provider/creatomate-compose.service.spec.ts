import { mock } from "@starci/jest-preset"
import { SOUND_SPEC, composeAccountOf } from "@tests/fixtures/builders/video-compose.builder"
import {
    CREATOMATE_ACCOUNT_ID,
    CREATOMATE_FAILED,
    CREATOMATE_RENDER_ID,
    CREATOMATE_SUCCEEDED,
    CREATOMATE_WEBHOOK_DONE,
} from "@tests/fixtures/builders/creatomate.builder"
import type { ConnectionsService } from "@modules/domain/connections"
import { proofOf, ProviderRegistryErrorCode, providerRefusalDetail, providerRefusalReason } from "@modules/domain/provider-registry"
import {
    CreatomateError,
    CreatomateErrorCode,
    creatomateRenderOf,
    type CreatomateClient,
    type CreatomateRender,
} from "@modules/integrations/creatomate"
import { CreatomateComposeService } from "./creatomate-compose.service"
import { CreatomateCredentialService } from "./creatomate-credential.service"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

const KEY = ["test", "key"].join("-")
const CALLBACK = { url: "https://hooks.test/api/connections/video-render/creatomate/c/secret" }

const account = composeAccountOf(CREATOMATE_ACCOUNT_ID, "creatomate")

const renderOf = (body: unknown): CreatomateRender => {
    const render = creatomateRenderOf(body)
    if (render === null) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "not a render" } })
    return render
}

const build = () => {
    const connections = mock<ConnectionsService>()
    connections.readSecret.mockResolvedValue({ plain: JSON.stringify({ apiKey: KEY }), webhookSecret: "hook" })
    const client = mock<CreatomateClient>()
    return { service: new CreatomateComposeService(client, new CreatomateCredentialService(connections)), client, connections }
}

const failure = (work: Promise<unknown>): Promise<unknown> => Promise.resolve(work.then(() => undefined, (cause: unknown) => cause))

describe("CreatomateComposeService > start", () => {
    it("posts the mapped RenderScript with the callback as webhook_url and answers the render id", async () => {
        const { service, client } = build()
        client.start.mockResolvedValue(renderOf({ id: CREATOMATE_RENDER_ID, status: "planned" }))

        await expect(service.start(account, SOUND_SPEC, CALLBACK)).resolves.toEqual({ renderId: CREATOMATE_RENDER_ID })
        const [key, request] = client.start.mock.calls[0] ?? []
        expect(key).toBe(KEY)
        expect(request?.webhookUrl).toBe(CALLBACK.url)
        expect(request?.source).toMatchObject({ output_format: "mp4", width: 720, height: 1280 })
        expect(request?.source.elements).toHaveLength(6)
    })

    it("sends no webhook_url without a callback", async () => {
        const { service, client } = build()
        client.start.mockResolvedValue(renderOf({ id: CREATOMATE_RENDER_ID, status: "planned" }))

        await service.start(account, SOUND_SPEC, null)

        expect(client.start.mock.calls[0]?.[1].webhookUrl).toBeNull()
    })

    it("refuses a spec the RenderScript cannot carry before any request, naming the member", async () => {
        const { service, client, connections } = build()

        const out = await failure(
            service.start(account, { ...SOUND_SPEC, captions: [{ text: "x", fromMs: 2000, toMs: 1000 }] }, CALLBACK),
        )

        expect(out).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected, params: { provider: "creatomate" } })
        expect(providerRefusalReason(out)).toBe("rejected")
        expect(providerRefusalDetail(out)).toContain("captions.0")
        expect(proofOf(out)).toBe("not_sent")
        expect(client.start).not.toHaveBeenCalled()
        expect(connections.readSecret).not.toHaveBeenCalled()
    })

    it("answers the provider words as a refusal proved not_sent when Creatomate rejects the request", async () => {
        const { service, client } = build()
        client.start.mockRejectedValue(new CreatomateError({ code: CreatomateErrorCode.Rejected, params: { status: 400, detail: "bad width" } }))

        const out = await failure(service.start(account, SOUND_SPEC, CALLBACK))

        expect(out).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected, params: { detail: "bad width" } })
        expect(proofOf(out)).toBe("not_sent")
    })

    it("proves a 5xx unknown (it may have rendered)", async () => {
        const { service, client } = build()
        client.start.mockRejectedValue(new CreatomateError({ code: CreatomateErrorCode.Failed, params: { status: 500, detail: "" } }))

        expect(proofOf(await failure(service.start(account, SOUND_SPEC, CALLBACK)))).toBe("unknown")
    })

    it("refuses with no_credential, not_sent, when the account holds no key or is another provider", async () => {
        const { service, client, connections } = build()
        connections.readSecret.mockResolvedValue({ plain: "{}", webhookSecret: "hook" })

        const out = await failure(service.start(account, SOUND_SPEC, CALLBACK))

        expect(out).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNoCredential })
        expect(proofOf(out)).toBe("not_sent")
        expect(client.start).not.toHaveBeenCalled()

        const other = await failure(service.start(composeAccountOf("id", "shotstack"), SOUND_SPEC, CALLBACK))
        expect(other).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNoCredential })
    })
})

describe("CreatomateComposeService > statusOf", () => {
    it("reads a succeeded render as done with its url", async () => {
        const { service, client } = build()
        client.render.mockResolvedValue(renderOf(CREATOMATE_SUCCEEDED))

        await expect(service.statusOf(account, CREATOMATE_RENDER_ID)).resolves.toEqual({
            renderId: CREATOMATE_RENDER_ID,
            status: "done",
            outputUrl: CREATOMATE_SUCCEEDED.url,
        })
        expect(client.render).toHaveBeenCalledWith(KEY, CREATOMATE_RENDER_ID)
    })

    it("reads a failed render with its words", async () => {
        const { service, client } = build()
        client.render.mockResolvedValue(renderOf(CREATOMATE_FAILED))

        await expect(service.statusOf(account, CREATOMATE_RENDER_ID)).resolves.toMatchObject({ status: "failed", error: CREATOMATE_FAILED.error_message })
    })

    it("answers not_found for a render the account does not hold", async () => {
        const { service, client } = build()
        client.render.mockRejectedValue(new CreatomateError({ code: CreatomateErrorCode.NotFound, params: { status: 404, detail: "" } }))

        expect(await failure(service.statusOf(account, CREATOMATE_RENDER_ID))).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNotFound })
    })
})

describe("CreatomateComposeService > webhook", () => {
    it("names no signature header and proves every delivery that reached the door", () => {
        const { service } = build()

        expect(service.webhook).toEqual({ signatureHeader: null, timestampHeader: null })
        expect(service.proves()).toBe(true)
        expect(service.provider).toBe("creatomate")
    })

    it("maps the webhook body with the pure completionOf", () => {
        const { service } = build()

        expect(service.completionOf(CREATOMATE_WEBHOOK_DONE)).toMatchObject({ renderId: CREATOMATE_RENDER_ID, status: "done" })
        expect(service.completionOf({ nothing: true })).toBeNull()
    })
})
