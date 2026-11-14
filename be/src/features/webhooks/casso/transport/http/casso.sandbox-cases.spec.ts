import { createHash } from "node:crypto"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { BankFeedReceiptService } from "@modules/domain/bank-feed-inbox"
import { BankFeedReceiptsService, type PaymentProofService } from "@modules/domain/billing"
import { CASSO_SANDBOX_CATALOGUE } from "@modules/domain/casso-provider"
import type { ConnectionsService } from "@modules/domain/connections"
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
import { CassoWebhook } from "./casso.webhook"

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }
const SANDBOX = connectionRecord({ id: "11111111-1111-4111-8111-111111111111", workspaceId: "ws-1", provider: "casso", sandbox: true })
const LIVE = connectionRecord({ id: "22222222-2222-4222-8222-222222222222", workspaceId: "ws-1", provider: "casso" })
const KEY = "sbx_key_1"
const NOW = new Date("2026-11-14T02:15:02.000Z")
const ASKED = { content: "NIVO DH1001", amount: 350_000 }

/**
 * THE ONE SEND of every Casso case (owner ruling R62) through the REAL Casso webhook controller: the Sandbox doors build the case's V2
 * body, the poster hands each call to `CassoWebhook.receive` exactly as the HTTP route would (the raw body bytes, the route's connection
 * id, the `x-nivo-sandbox-key` header), the real `ScopedWebhookVerifier` runs the real shared sandbox-key guard, and the REAL
 * `BankFeedReceiptsService.acceptCassoDelivery` reads the delivered bytes into the credits the feed claims. Only the database behind it
 * (the transaction, the inbox claim, the outbox) and the live proof registry are doubles.
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
    const tx = fakeTransaction(mockEntityManager())
    const receipts = new BankFeedReceiptsService(
        tx.em,
        mock<PaymentProofService>(),
        claims,
        mock<FeedWebhookRegistryService>(),
        recordingQueueOutbox(),
    )
    const door = new CassoWebhook(new ScopedWebhookVerifier(proofs, guard), receipts)
    /** What the HTTP route does with one call: the raw bytes, the id the path names, the sandbox header. Casso's ack is HTTP 200, empty. */
    const route = async (call: SandboxWebhookPost) => {
        const connectionId = call.path.split("/").at(-1) ?? ""
        const rawBody = Buffer.from(JSON.stringify(call.body))
        try {
            await door.receive(
                mock<RawBodyRequest<Request>>({ rawBody }),
                connectionId,
                undefined,
                undefined,
                call.headers[SANDBOX_KEY_HEADER],
            )
            return { status: 200, body: "" }
        } catch (cause) {
            return { status: 401, body: { code: (cause as { code?: string }).code } }
        }
    }
    const poster = new RecordingWebhookPoster(route)
    const catalogues = new SandboxCatalogueRegistryService()
    catalogues.register(CASSO_SANDBOX_CATALOGUE)
    const doors = new ProviderSandboxAccountsService(connections, sandbox, catalogues, poster, { now: () => NOW })
    /** The credits the feed claimed, as the real Casso reading made them, with the delivery key each came under. */
    const claimed = () =>
        claims.claim.mock.calls.map(([, provider, deliveryId, payload]) => ({ provider, deliveryId, ...payload }))
    return { doors, proofs, claimed, route, poster }
}

describe("Casso sandbox cases on the real Casso webhook controller (R62)", () => {
    it.each([
        ["CASSO-1", 1, { amount: 350_000, content: "NIVO DH1001" }],
        ["CASSO-2", 1, { amount: 349_000, content: "NIVO DH1001" }],
        ["CASSO-3", 1, { amount: 351_000, content: "NIVO DH1001" }],
        ["CASSO-4", 1, { amount: 350_000, content: "" }],
        ["CASSO-6", 2, { amount: 350_000, content: "NIVO DH1001" }],
        ["CASSO-7", 1, { amount: 350_000, content: "NIVO DH0000" }],
    ])("%s reaches the feed intake %d time(s) as the credit %j, proven by the sandbox key (no Casso proof asked)", async (caseId, times, credit) => {
        const { doors, proofs, claimed } = world()

        const sent = await doors.send(ACTOR, SANDBOX.id, caseId, ASKED)

        expect(sent.deliveries).toEqual(Array.from({ length: times }, () => ({ path: `api/connections/casso/${SANDBOX.id}`, status: 200, body: "" })))
        expect(proofs.verify).not.toHaveBeenCalled()
        const reads = claimed()
        expect(reads).toHaveLength(times)
        for (const one of reads) {
            expect(one).toMatchObject({ provider: "casso", connection: SANDBOX.id })
            expect(one.credits).toEqual([
                expect.objectContaining({
                    ...credit,
                    eventId: "casso:7100001",
                    account: "0011004455667",
                    bankRef: "FT267100001",
                    fallbackBankName: "Vietcombank",
                    occurredAt: NOW.toISOString(),
                }),
            ])
        }
        // The same transaction twice is the same bytes, so the same delivery key: the inbox keeps it once.
        expect(new Set(reads.map((one) => one.deliveryId)).size).toBe(1)
    })

    it("CASSO-5 (money out) is delivered and proven, but Casso's negative amount is no credit: the feed claims nothing", async () => {
        const { doors, proofs, claimed, poster } = world()

        const sent = await doors.send(ACTOR, SANDBOX.id, "CASSO-5", ASKED)

        expect(sent.deliveries).toEqual([{ path: `api/connections/casso/${SANDBOX.id}`, status: 200, body: "" }])
        expect(proofs.verify).not.toHaveBeenCalled()
        expect((poster.posts[0]?.body as { data: { amount: number } }).data.amount).toBe(-350_000)
        expect(claimed()).toEqual([])
    })

    it("keys the delivery by the connection and the sha256 of the delivered bytes, as the live intake does", async () => {
        const { doors, poster, claimed } = world()

        await doors.send(ACTOR, SANDBOX.id, "CASSO-1", ASKED)

        const bytes = Buffer.from(JSON.stringify(poster.posts[0]?.body))
        expect(claimed()[0]?.deliveryId).toBe(`${SANDBOX.id}:${createHash("sha256").update(bytes).digest("hex")}`)
    })

    it("refuses a call for the sandbox account without its key or with a wrong one, and a LIVE account still runs Casso's own signature proof", async () => {
        const { route, proofs, claimed } = world()
        const body = { error: 0, data: { id: 1, amount: 1_000, description: "x" } }

        await expect(route({ path: `api/connections/casso/${SANDBOX.id}`, body, headers: { [SANDBOX_KEY_HEADER]: "wrong" } })).resolves.toEqual({
            status: 401,
            body: { code: "PROVIDER_SANDBOX_WEBHOOK_KEY_REFUSED" },
        })
        await expect(route({ path: `api/connections/casso/${SANDBOX.id}`, body, headers: {} })).resolves.toMatchObject({ status: 401 })
        expect(proofs.verify).not.toHaveBeenCalled()
        expect(claimed()).toEqual([])

        await route({ path: `api/connections/casso/${LIVE.id}`, body, headers: { [SANDBOX_KEY_HEADER]: KEY } })
        expect(proofs.verify).toHaveBeenCalledTimes(1)
        expect(proofs.verify).toHaveBeenCalledWith("casso", expect.objectContaining({ scope: LIVE.id }))
    })
})
