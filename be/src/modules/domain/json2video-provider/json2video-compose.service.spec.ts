import { mock } from "@starci/jest-preset"
import type { ConnectionRecord, ConnectionsService } from "@modules/domain/connections"
import { proofOf, ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import { Json2videoError, Json2videoErrorCode } from "@modules/integrations/json2video"
import type { Json2VideoClient } from "@modules/integrations/json2video"
import type { Clock } from "@modules/platform/clock"
import {
    J2V_HOOK_FAILURE,
    J2V_HOOK_SUCCESS,
    J2V_KEY,
    J2V_PROJECT,
    J2V_STATUS_DONE,
    J2V_STATUS_RUNNING,
    J2V_URL,
} from "../../../tests/fixtures/builders/json2video.builder"
import { SOUND_SPEC } from "../../../tests/fixtures/builders/video-compose.builder"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { json2videoMovieOf } from "@modules/integrations/json2video"
import { Json2VideoComposeService } from "./json2video-compose.service"
import { Json2VideoCredentialService } from "./json2video-credential.service"
import { movieOf } from "./json2video-movie.policy"

const account = (provider: ConnectionRecord["provider"] = "json2video"): ConnectionRecord =>
    connectionRecord({ id: "conn-j", workspaceId: "ws-1", provider, name: "JSON2Video", meta: {} })

const CALLBACK = { url: "https://nivo.test/api/connections/video-render/json2video/conn-j/hook-secret" }

const build = (sealed: string = JSON.stringify({ apiKey: J2V_KEY })) => {
    const connections = mock<ConnectionsService>()
    connections.readSecret.mockResolvedValue({ plain: sealed, webhookSecret: "hook-secret" })
    const client = mock<Json2VideoClient>()
    const clock = mock<Clock>()
    clock.now.mockReturnValue(new Date("2026-05-12T07:42:41.946Z"))
    return { service: new Json2VideoComposeService(client, new Json2VideoCredentialService(connections), clock), client }
}

const failure = (work: Promise<unknown>): Promise<unknown> => Promise.resolve(work.then(() => undefined, (cause: unknown) => cause))

describe("Json2VideoComposeService > port", () => {
    it("is the json2video provider, with a webhook that signs nothing", () => {
        const { service } = build()

        expect(service.provider).toBe("json2video")
        expect(service.webhook).toEqual({ signatureHeader: null, timestampHeader: null })
    })

    it("proves any delivery (the door's path token already did)", () => {
        const { service } = build()

        expect(service.proves({ rawBody: Buffer.from("{}"), signature: undefined, timestamp: undefined }, { plain: "{}", webhookSecret: "s" })).toBe(true)
    })

    it("maps a webhook body through the pure completion", () => {
        const { service } = build()

        expect(service.completionOf(J2V_HOOK_SUCCESS)).toMatchObject({ renderId: J2V_PROJECT, status: "done" })
        expect(service.completionOf(J2V_HOOK_FAILURE)).toMatchObject({ renderId: J2V_PROJECT, status: "failed" })
        expect(service.completionOf({ nothing: true })).toBeNull()
    })
})

describe("Json2VideoComposeService > start", () => {
    it("posts the mapped movie with the callback as the webhook export and answers the project as the render id", async () => {
        const { service, client } = build()
        client.create.mockResolvedValue({ project: J2V_PROJECT })

        await expect(service.start(account(), SOUND_SPEC, CALLBACK)).resolves.toEqual({ renderId: J2V_PROJECT })

        const expected = movieOf(SOUND_SPEC, CALLBACK)
        expect(expected.ok).toBe(true)
        expect(client.create).toHaveBeenCalledWith(J2V_KEY, expected.ok ? expected.movie : undefined)
        expect(client.create.mock.calls[0]?.[1].exports).toEqual([{ destinations: [{ type: "webhook", endpoint: CALLBACK.url }] }])
    })

    it("sends no export when there is no callback", async () => {
        const { service, client } = build()
        client.create.mockResolvedValue({ project: J2V_PROJECT })

        await service.start(account(), SOUND_SPEC, null)

        expect(client.create.mock.calls[0]?.[1].exports).toBeUndefined()
    })

    it("refuses a movie over 2 MB: rejected, proved not_sent, no request", async () => {
        const { service, client } = build()

        const thrown = await failure(service.start(account(), SOUND_SPEC, { url: `https://x.test/${"z".repeat(2_100_000)}` }))

        expect(thrown).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected, params: { provider: "json2video" } })
        expect(proofOf(thrown)).toBe("not_sent")
        expect(client.create).not.toHaveBeenCalled()
    })

    it("sends nothing without a key: no_credential, proved not_sent", async () => {
        const { service, client } = build(JSON.stringify({}))

        const thrown = await failure(service.start(account(), SOUND_SPEC, null))

        expect(thrown).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNoCredential })
        expect(proofOf(thrown)).toBe("not_sent")
        expect(client.create).not.toHaveBeenCalled()
    })

    it("sends nothing for an account of another provider", async () => {
        const { service, client } = build()

        const thrown = await failure(service.start(account("shotstack"), SOUND_SPEC, null))

        expect(thrown).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNoCredential })
        expect(client.create).not.toHaveBeenCalled()
    })

    it("turns a provider refusal into a rejected provider refusal carrying the provider's words, proved not_sent", async () => {
        const { service, client } = build()
        client.create.mockRejectedValue(
            new Json2videoError({ code: Json2videoErrorCode.Rejected, params: { status: 400, word: "", detail: "Invalid movie JSON" } }),
        )

        const thrown = await failure(service.start(account(), SOUND_SPEC, null))

        expect(thrown).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected, params: { detail: "Invalid movie JSON" } })
        expect(proofOf(thrown)).toBe("not_sent")
    })

    it("turns a 401 into auth_refused", async () => {
        const { service, client } = build()
        client.create.mockRejectedValue(
            new Json2videoError({ code: Json2videoErrorCode.AuthFailed, params: { status: 401, word: "", detail: "quota" } }),
        )

        expect(await failure(service.start(account(), SOUND_SPEC, null))).toMatchObject({ code: ProviderRegistryErrorCode.RefusedAuth, params: { detail: "quota" } })
    })
})

describe("Json2VideoComposeService > statusOf", () => {
    it("reads a done movie as done with its address", async () => {
        const { service, client } = build()
        client.movie.mockResolvedValue(json2videoMovieOf(J2V_STATUS_DONE))

        await expect(service.statusOf(account(), J2V_PROJECT)).resolves.toEqual({ renderId: J2V_PROJECT, status: "done", outputUrl: J2V_URL })
        expect(client.movie).toHaveBeenCalledWith(J2V_KEY, J2V_PROJECT)
    })

    it("reads a running movie as rendering", async () => {
        const { service, client } = build()
        client.movie.mockResolvedValue(json2videoMovieOf(J2V_STATUS_RUNNING))

        await expect(service.statusOf(account(), J2V_PROJECT)).resolves.toEqual({ renderId: J2V_PROJECT, status: "rendering" })
    })

    it("fails a render that ran past 15 minutes by the clock the service was given", async () => {
        const { service, client } = build()
        client.movie.mockResolvedValue(json2videoMovieOf(J2V_STATUS_RUNNING))
        const late = mock<Clock>()
        late.now.mockReturnValue(new Date("2026-05-12T08:00:00.000Z"))
        const connections = mock<ConnectionsService>()
        connections.readSecret.mockResolvedValue({ plain: JSON.stringify({ apiKey: J2V_KEY }), webhookSecret: "h" })

        const status = await new Json2VideoComposeService(client, new Json2VideoCredentialService(connections), late).statusOf(account(), J2V_PROJECT)

        expect(status).toMatchObject({ status: "failed" })
        expect(service.provider).toBe("json2video")
    })

    it("answers a project the account does not hold as the provider's refusal (the 400 of the docs)", async () => {
        const { service, client } = build()
        client.movie.mockRejectedValue(
            new Json2videoError({ code: Json2videoErrorCode.Rejected, params: { status: 400, word: "", detail: "Movie x not found." } }),
        )

        const thrown = await failure(service.statusOf(account(), J2V_PROJECT))

        expect(thrown).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected, params: { detail: "Movie x not found." } })
        expect(proofOf(thrown)).toBe("not_sent")
    })
})
