import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import type { ConnectionsService } from "@modules/domain/connections"
import {
    ProviderSandboxAccountsService,
    SANDBOX_KEY_HEADER,
    SandboxCatalogueRegistryService,
    SandboxWebhookKeyService,
    type SandboxWebhookPost,
} from "@modules/domain/provider-sandbox"
import { ZaloDeliveryIntakeService } from "@modules/domain/zalo-inbox"
import { zaloEventKeyOf } from "@modules/domain/zalo-inbox/zalo-delivery-id.policy"
import { zaloEventRowsOf } from "@modules/domain/zalo-inbox/zalo.normalise.policy"
import { ZALO_SANDBOX_CATALOGUE } from "@modules/domain/zalo-provider/zalo-sandbox.catalogue"
import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import type { WebhookProofRegistry } from "@modules/platform/http-security"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { RecordingWebhookPoster, sandboxServiceOf } from "@tests/fixtures/builders/provider-sandbox.builder"
import { ZaloWebhook } from "./zalo.webhook"

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }
const SANDBOX = connectionRecord({ id: "11111111-1111-4111-8111-111111111111", workspaceId: "ws-1", provider: "zalo_oa", sandbox: true })
const LIVE = connectionRecord({ id: "22222222-2222-4222-8222-222222222222", workspaceId: "ws-1", provider: "zalo_oa" })
const KEY = "sbx_key_1"
const NOW = new Date("2026-11-14T02:15:02.000Z")
const ASKED = { userId: "8800110022", text: "Chao shop, cho minh hoi gia bo hoa hong do nhe" }

/**
 * THE ONE SEND of every Zalo case (owner ruling R62) through the REAL Zalo webhook controller: the Sandbox doors build the case's body,
 * the poster hands each call to `ZaloWebhook.receive` exactly as the HTTP route would (the raw body bytes, the route's connection id, the
 * `x-nivo-sandbox-key` header), the real shared verifier asks the real sandbox key guard, and the real Zalo reading of the delivered bytes
 * (event key and event row) is asserted. Only the inbox intake behind the controller and the live MAC registry are doubles.
 */
const world = () => {
    const connections = mock<ConnectionsService>()
    connections.authorize.mockResolvedValue({ role: "owner", displayName: "Lan" })
    connections.find.mockImplementation((_ws, id) => Promise.resolve([SANDBOX, LIVE].find((one) => one.id === id) ?? null))
    connections.sandboxKeyOf.mockImplementation((_ws, id) => Promise.resolve(id === SANDBOX.id ? KEY : null))
    connections.isSandboxKey.mockImplementation((id, presented) => id === SANDBOX.id && presented === KEY)
    const { sandbox, store } = sandboxServiceOf(SANDBOX, LIVE)
    const guard = new SandboxWebhookKeyService(store, { enabled: true }, connections)
    const proofs = mock<WebhookProofRegistry>()
    proofs.verify.mockResolvedValue(undefined)
    const deliveries = mock<ZaloDeliveryIntakeService>()
    deliveries.accept.mockResolvedValue(undefined)
    const door = new ZaloWebhook(new ScopedWebhookVerifier(proofs, guard), deliveries)
    /** What the HTTP route does with one call: the raw bytes, the id the path names, the sandbox header. */
    const route = async (call: SandboxWebhookPost) => {
        const connectionId = call.path.split("/").at(-1) ?? ""
        const rawBody = Buffer.from(JSON.stringify(call.body))
        try {
            await door.receive(mock<RawBodyRequest<Request>>({ rawBody }), { connectionId }, undefined, call.headers[SANDBOX_KEY_HEADER])
            return { status: 200, body: null }
        } catch (cause) {
            return { status: 401, body: { code: (cause as { code?: string }).code } }
        }
    }
    const poster = new RecordingWebhookPoster(route)
    const catalogues = new SandboxCatalogueRegistryService()
    catalogues.register(ZALO_SANDBOX_CATALOGUE)
    const doors = new ProviderSandboxAccountsService(connections, sandbox, catalogues, poster, { now: () => NOW })
    /** What the controller handed its intake: the bytes, the connection, and the real Zalo reading of them. */
    const accepted = () =>
        deliveries.accept.mock.calls.map(([raw, connection]) => ({
            connection,
            key: zaloEventKeyOf(raw as Buffer),
            rows: zaloEventRowsOf(raw as Buffer),
            body: JSON.parse(String(raw)) as Record<string, unknown>,
        }))
    return { doors, proofs, deliveries, accepted, route }
}

describe("Zalo sandbox cases on the real Zalo webhook controller (R62)", () => {
    it.each([
        ["ZALO-1", "user_send_text", NOW.getTime(), ASKED],
        ["ZALO-2", "user_send_image", NOW.getTime(), { userId: ASKED.userId }],
        ["ZALO-3", "user_send_text", NOW.getTime() - 49 * 3_600_000, ASKED],
    ])("%s reaches the intake once as %s stamped %d, proven by the sandbox key (no Zalo MAC asked)", async (caseId, event, stamp, input) => {
        const { doors, proofs, accepted } = world()

        const sent = await doors.send(ACTOR, SANDBOX.id, caseId, input)

        expect(sent.deliveries).toEqual([{ path: `api/connections/zalo/${SANDBOX.id}`, status: 200, body: null }])
        expect(proofs.verify).not.toHaveBeenCalled()
        const [one, ...rest] = accepted()
        expect(rest).toEqual([])
        expect(one).toMatchObject({ connection: SANDBOX.id, key: "sbx-zmsg-000001" })
        expect(one?.rows).toEqual([
            { type: expect.any(String), value: expect.objectContaining({ eventId: "sbx-zmsg-000001", event, raw: expect.objectContaining({ timestamp: String(stamp) }) }) },
        ])
        expect(one?.body).toMatchObject({ event_name: event, sender: { id: ASKED.userId }, message: { msg_id: "sbx-zmsg-000001" } })
    })

    it("runs the message id on across the account's sends", async () => {
        const { doors, accepted } = world()

        await doors.send(ACTOR, SANDBOX.id, "ZALO-1", ASKED)
        await doors.send(ACTOR, SANDBOX.id, "ZALO-2", { userId: ASKED.userId })

        expect(accepted().map((one) => one.key)).toEqual(["sbx-zmsg-000001", "sbx-zmsg-000002"])
    })

    it("refuses a call for the sandbox account without its key, and a LIVE account still runs the Zalo signature proof", async () => {
        const { route, deliveries, proofs } = world()

        await expect(route({ path: `api/connections/zalo/${SANDBOX.id}`, body: { event_name: "user_send_text" }, headers: { [SANDBOX_KEY_HEADER]: "wrong" } })).resolves.toEqual({
            status: 401,
            body: { code: "PROVIDER_SANDBOX_WEBHOOK_KEY_REFUSED" },
        })
        expect(deliveries.accept).not.toHaveBeenCalled()

        await route({ path: `api/connections/zalo/${LIVE.id}`, body: { event_name: "user_send_text" }, headers: { [SANDBOX_KEY_HEADER]: KEY } })
        expect(proofs.verify).toHaveBeenCalledTimes(1)
        expect(proofs.verify).toHaveBeenCalledWith("zalo", expect.objectContaining({ scope: LIVE.id }))
    })
})
