import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { AccountDataIntakeService } from "@modules/domain/account-data"
import { GenericWebhookIntakeService } from "@modules/domain/agent-inbound"
import type { ConnectionsService } from "@modules/domain/connections"
import {
    ProviderSandboxAccountsService,
    SANDBOX_KEY_HEADER,
    SandboxCatalogueRegistryService,
    SandboxWebhookKeyService,
    type SandboxWebhookPost,
} from "@modules/domain/provider-sandbox"
import { WEBHOOK_SANDBOX_CATALOGUE } from "@modules/domain/webhook-connections"
import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import type { WebhookProofRegistry } from "@modules/platform/http-security"
import type { GenericWebhookQueue } from "@modules/queues/generic-webhook"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { RecordingWebhookPoster, sandboxServiceOf } from "@tests/fixtures/builders/provider-sandbox.builder"
import { GenericWebhook } from "./generic.webhook"

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }
const SANDBOX = connectionRecord({ id: "11111111-1111-4111-8111-111111111111", workspaceId: "ws-1", provider: "webhook", sandbox: true })
const LIVE = connectionRecord({ id: "22222222-2222-4222-8222-222222222222", workspaceId: "ws-1", provider: "webhook" })
const KEY = "sbx_key_1"
const NOW = new Date("2026-11-14T02:15:02.000Z")
const ASKED = { type: "invoice.paid", reference: "INV-1001" }
const ROUTE = `api/inbound/${SANDBOX.id}`

/**
 * THE ONE SEND of every generic webhook case (owner ruling R62) through the REAL generic controller: the Sandbox doors build the case's
 * body, the poster hands each call to `GenericWebhook.receive` exactly as the HTTP route would (the raw bytes, the route's connection id,
 * the sender's own headers, the `x-nivo-sandbox-key` header), the real `ScopedWebhookVerifier` runs the real shared sandbox-key guard and
 * the REAL `GenericWebhookIntakeService` reads the delivered bytes into the delivery the endpoint's account claims. Only the database
 * behind it (the transaction, the account's claim, the queue) and the live proof registry are doubles.
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
    const tx = fakeTransaction(mockEntityManager())
    // The claim answers a new row the first time a key is seen and nothing after (the account keeps a delivery once).
    const seen = new Set<string>()
    const account = mock<AccountDataIntakeService>()
    account.claim.mockImplementation((_tx, claim) => {
        const key = `${claim.connectionId}:${String(Reflect.get(claim.value, "deliveryId"))}`
        if (seen.has(key)) return Promise.resolve(undefined)
        seen.add(key)
        return Promise.resolve({ type: claim.type, key, id: `row-${String(seen.size)}`, isNew: true })
    })
    const queue = mock<GenericWebhookQueue>({ enqueueDeliver: jest.fn().mockResolvedValue(undefined) })
    const door = new GenericWebhook(new ScopedWebhookVerifier(proofs, guard), new GenericWebhookIntakeService(tx.em, account, queue))
    /** What the HTTP route does with one call: the raw bytes, the id the path names, the sender's own headers, the sandbox header. 202 is the door's ack. */
    const route = async (call: SandboxWebhookPost) => {
        const connectionId = call.path.split("/").at(-1) ?? ""
        const rawBody = Buffer.from(JSON.stringify(call.body))
        try {
            await door.receive(
                mock<RawBodyRequest<Request>>({ rawBody }),
                { connectionId },
                call.headers["x-signature"],
                call.headers["x-event-type"],
                call.headers["x-idempotency-key"],
                call.headers[SANDBOX_KEY_HEADER],
            )
            return { status: 202, body: "" }
        } catch (cause) {
            const code = (cause as { code?: string }).code
            return { status: code === "PROVIDER_SANDBOX_WEBHOOK_KEY_REFUSED" ? 401 : 400, body: { code } }
        }
    }
    const poster = new RecordingWebhookPoster(route)
    const catalogues = new SandboxCatalogueRegistryService()
    catalogues.register(WEBHOOK_SANDBOX_CATALOGUE)
    const doors = new ProviderSandboxAccountsService(connections, sandbox, catalogues, poster, { now: () => NOW })
    /** The deliveries the account claimed, as the real intake read them. */
    const claimed = () => account.claim.mock.calls.map(([, claim]) => claim)
    return { doors, proofs, claimed, queue, route, poster }
}

describe("generic webhook sandbox cases on the real generic controller (R62)", () => {
    it("WEBHOOK-1 posts the event the sender named to the endpoint's own route, proven by the sandbox key (no endpoint signature asked), and the account claims it once under the sender's id", async () => {
        const { doors, proofs, claimed, queue, poster } = world()

        const sent = await doors.send(ACTOR, SANDBOX.id, "WEBHOOK-1", ASKED)

        expect(sent.deliveries).toEqual([{ path: ROUTE, status: 202, body: "" }])
        expect(poster.posts[0]?.body).toEqual({ type: "invoice.paid", id: "sbx-evt-000001", data: { reference: "INV-1001" } })
        expect(proofs.verify).not.toHaveBeenCalled()
        expect(claimed()).toEqual([
            {
                connectionId: SANDBOX.id,
                type: "webhook.delivery",
                value: {
                    deliveryId: "sbx-evt-000001",
                    raw: { type: "invoice.paid", id: "sbx-evt-000001", data: { reference: "INV-1001" } },
                },
            },
        ])
        expect(queue.enqueueDeliver).toHaveBeenCalledTimes(1)
    })

    it("WEBHOOK-2 posts the SAME event twice: both are acknowledged, the account keeps it once and the receipt is queued once", async () => {
        const { doors, claimed, queue } = world()

        const sent = await doors.send(ACTOR, SANDBOX.id, "WEBHOOK-2", ASKED)

        expect(sent.deliveries.map((one) => one.status)).toEqual([202, 202])
        expect(claimed()).toHaveLength(2)
        expect(new Set(claimed().map((one) => one.value.deliveryId)).size).toBe(1)
        expect(queue.enqueueDeliver).toHaveBeenCalledTimes(1)
    })

    it("WEBHOOK-3 names the type and the delivery key in the headers, a body with neither: the sender's headers reach the door and the key is the row's id", async () => {
        const { doors, claimed, poster } = world()

        await doors.send(ACTOR, SANDBOX.id, "WEBHOOK-3", ASKED)

        expect(poster.posts[0]?.headers).toMatchObject({ "x-event-type": "invoice.paid", "x-idempotency-key": "sbx-evt-000001", [SANDBOX_KEY_HEADER]: KEY })
        expect(poster.posts[0]?.body).toEqual({ data: { reference: "INV-1001" } })
        expect(claimed()[0]?.value).toMatchObject({ deliveryId: "sbx-evt-000001", eventType: "invoice.paid", deliveryKey: "sbx-evt-000001" })
    })

    it("WEBHOOK-4 names no id: the fact is the digest of the bytes, and a second send is a NEW fact (the running number is in the data)", async () => {
        const { doors, claimed, queue } = world()

        await doors.send(ACTOR, SANDBOX.id, "WEBHOOK-4", ASKED)
        await doors.send(ACTOR, SANDBOX.id, "WEBHOOK-4", ASKED)

        const ids = claimed().map((one) => String(one.value.deliveryId))
        expect(ids).toHaveLength(2)
        expect(ids.every((id) => /^[0-9a-f]{64}$/u.test(id))).toBe(true)
        expect(new Set(ids).size).toBe(2)
        expect(queue.enqueueDeliver).toHaveBeenCalledTimes(2)
    })

    it.each([
        ["WEBHOOK-5", "a JSON list is no event", "AGENT_INBOUND_BODY_INVALID"],
        ["WEBHOOK-6", "a type that is no event identity", "AGENT_INBOUND_EVENT_TYPE_INVALID"],
    ])("%s (%s) is refused by the door with %s before anything is claimed or queued", async (caseId, _name, code) => {
        const { doors, claimed, queue } = world()

        const sent = await doors.send(ACTOR, SANDBOX.id, caseId, ASKED)

        expect(sent.deliveries).toEqual([{ path: ROUTE, status: 400, body: { code } }])
        expect(claimed()).toEqual([])
        expect(queue.enqueueDeliver).not.toHaveBeenCalled()
    })

    it("the ids run per account: the second send of WEBHOOK-1 is sbx-evt-000002", async () => {
        const { doors, poster } = world()

        await doors.send(ACTOR, SANDBOX.id, "WEBHOOK-1", ASKED)
        await doors.send(ACTOR, SANDBOX.id, "WEBHOOK-1", ASKED)

        expect(poster.posts.map((post) => (post.body as { id: string }).id)).toEqual(["sbx-evt-000001", "sbx-evt-000002"])
    })

    it("refuses a call for the sandbox account without its key or with a wrong one, and a LIVE account still runs the endpoint's own signature proof", async () => {
        const { route, proofs, claimed } = world()
        const body = { type: "invoice.paid", id: "x" }

        await expect(route({ path: ROUTE, body, headers: { [SANDBOX_KEY_HEADER]: "wrong" } })).resolves.toEqual({
            status: 401,
            body: { code: "PROVIDER_SANDBOX_WEBHOOK_KEY_REFUSED" },
        })
        await expect(route({ path: ROUTE, body, headers: {} })).resolves.toMatchObject({ status: 401 })
        expect(proofs.verify).not.toHaveBeenCalled()
        expect(claimed()).toEqual([])

        await route({ path: `api/inbound/${LIVE.id}`, body, headers: { [SANDBOX_KEY_HEADER]: KEY } })
        expect(proofs.verify).toHaveBeenCalledTimes(1)
        expect(proofs.verify).toHaveBeenCalledWith("generic_webhook", expect.objectContaining({ scope: LIVE.id }))
    })
})
