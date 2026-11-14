import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { BankFeedReceiptService } from "@modules/domain/bank-feed-inbox"
import { BankFeedReceiptsService, type PaymentProofService } from "@modules/domain/billing"
import type { ConnectionsService } from "@modules/domain/connections"
import { PAYOS_SANDBOX_CATALOGUE } from "@modules/domain/payos-provider"
import type { FeedWebhookRegistryService } from "@modules/domain/provider-registry"
import {
    ProviderSandboxAccountsService,
    SANDBOX_KEY_HEADER,
    SandboxCatalogueRegistryService,
    SandboxWebhookKeyService,
    type SandboxWebhookPost,
} from "@modules/domain/provider-sandbox"
import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import type { WebhookProofRegistry } from "@modules/platform/http-security"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { RecordingWebhookPoster, sandboxServiceOf } from "@tests/fixtures/builders/provider-sandbox.builder"
import { PayosWebhook } from "./payos.webhook"

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }
const SANDBOX = connectionRecord({ id: "11111111-1111-4111-8111-111111111111", workspaceId: "ws-1", provider: "payos", sandbox: true })
const LIVE = connectionRecord({ id: "22222222-2222-4222-8222-222222222222", workspaceId: "ws-1", provider: "payos" })
const KEY = "sbx_key_1"
const NOW = new Date("2026-11-14T02:15:02.000Z")

/**
 * THE ONE SEND of the payOS paid case (owner ruling R62) through the REAL payOS webhook controller: the Sandbox doors build the paid body,
 * the poster hands it to `PayosWebhook.receive` as the HTTP route would, the real `ScopedWebhookVerifier` runs the real shared sandbox-key
 * guard, and the REAL `BankFeedReceiptsService.acceptPayosDelivery` reads the delivered bytes into the credit the feed claims. Only the
 * database behind it and the live proof registry are doubles.
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
    const claims = mock<BankFeedReceiptService>()
    claims.claim.mockResolvedValue(true)
    const receipts = new BankFeedReceiptsService(
        fakeTransaction(mockEntityManager()).em,
        mock<PaymentProofService>(),
        claims,
        mock<FeedWebhookRegistryService>(),
        recordingQueueOutbox(),
    )
    const door = new PayosWebhook(new ScopedWebhookVerifier(proofs, guard), receipts)
    /** What the HTTP route does with one call: the raw bytes, the id the path names, the sandbox header. payOS's ack is HTTP 200, empty. */
    const route = async (call: SandboxWebhookPost) => {
        const connectionId = call.path.split("/").at(-1) ?? ""
        const rawBody = Buffer.from(JSON.stringify(call.body))
        try {
            await door.receive(mock<RawBodyRequest<Request>>({ rawBody }), connectionId, call.headers[SANDBOX_KEY_HEADER])
            return { status: 200, body: "" }
        } catch (cause) {
            return { status: 401, body: { code: (cause as { code?: string }).code } }
        }
    }
    const catalogues = new SandboxCatalogueRegistryService()
    catalogues.register(PAYOS_SANDBOX_CATALOGUE)
    const doors = new ProviderSandboxAccountsService(connections, sandbox, catalogues, new RecordingWebhookPoster(route), { now: () => NOW })
    /** The credits the feed claimed, as the real payOS reading made them. */
    const claimed = () => claims.claim.mock.calls.map(([, provider, deliveryId, payload]) => ({ provider, deliveryId, ...payload }))
    return { doors, proofs, claimed, route }
}

describe("payOS sandbox paid case on the real payOS webhook controller (R62)", () => {
    it("PAYOS-3 reaches the feed intake as the credit of the order code named, proven by the sandbox key (no checksum asked)", async () => {
        const { doors, proofs, claimed } = world()

        const sent = await doors.send(ACTOR, SANDBOX.id, "PAYOS-3", { orderCode: 1_780_000_000_001 })

        expect(sent.deliveries).toEqual([{ path: `api/connections/payos/${SANDBOX.id}`, status: 200, body: "" }])
        expect(proofs.verify).not.toHaveBeenCalled()
        expect(claimed()).toEqual([
            {
                provider: "payos",
                deliveryId: `${SANDBOX.id}:payos:SBXPAYOS000001`,
                connection: SANDBOX.id,
                credits: [
                    expect.objectContaining({
                        amount: 150_000,
                        content: "DH001",
                        eventId: "payos:SBXPAYOS000001",
                        bankRef: "SBXPAYOS000001",
                        account: "12345678",
                        occurredAt: NOW.toISOString(),
                    }),
                ],
            },
        ])
    })

    it("a second paid order is its own transaction (its own reference), not a duplicate of the first", async () => {
        const { doors, claimed } = world()

        await doors.send(ACTOR, SANDBOX.id, "PAYOS-3", { orderCode: 1_780_000_000_001 })
        await doors.send(ACTOR, SANDBOX.id, "PAYOS-3", { orderCode: 1_780_000_000_002 })

        expect(claimed().map((one) => one.deliveryId)).toEqual([`${SANDBOX.id}:payos:SBXPAYOS000001`, `${SANDBOX.id}:payos:SBXPAYOS000002`])
    })

    it("refuses a call for the sandbox account without its key or with a wrong one, and a LIVE account still runs payOS's own signature proof", async () => {
        const { route, proofs, claimed } = world()
        const body = { code: "00", success: true, data: { orderCode: 5, amount: 1_000, reference: "R1" }, signature: "x" }

        await expect(route({ path: `api/connections/payos/${SANDBOX.id}`, body, headers: { [SANDBOX_KEY_HEADER]: "wrong" } })).resolves.toEqual({
            status: 401,
            body: { code: "PROVIDER_SANDBOX_WEBHOOK_KEY_REFUSED" },
        })
        await expect(route({ path: `api/connections/payos/${SANDBOX.id}`, body, headers: {} })).resolves.toMatchObject({ status: 401 })
        expect(proofs.verify).not.toHaveBeenCalled()
        expect(claimed()).toEqual([])

        await route({ path: `api/connections/payos/${LIVE.id}`, body, headers: { [SANDBOX_KEY_HEADER]: KEY } })
        expect(proofs.verify).toHaveBeenCalledTimes(1)
        expect(proofs.verify).toHaveBeenCalledWith("payos", expect.objectContaining({ scope: LIVE.id }))
    })
})
