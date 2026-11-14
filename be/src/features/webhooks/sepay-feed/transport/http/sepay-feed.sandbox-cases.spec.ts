import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import { BankFeedIntakeService, BankFeedReceiptsService } from "@modules/domain/billing"
import type { SepayConnectionService } from "@modules/domain/channel-connections"
import type { ConnectionsService } from "@modules/domain/connections"
import type { FeedWebhookRegistryService } from "@modules/domain/provider-registry"
import {
    ProviderSandboxAccountsService,
    SANDBOX_KEY_HEADER,
    SandboxCatalogueRegistryService,
    SandboxWebhookKeyService,
    type SandboxWebhookPost,
} from "@modules/domain/provider-sandbox"
import { SEPAY_SANDBOX_CATALOGUE, SepayFeedWebhookService } from "@modules/domain/sepay-provider"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { RecordingWebhookPoster, sandboxServiceOf } from "@tests/fixtures/builders/provider-sandbox.builder"
import { PROVIDER_ACK, SepayFeedWebhook } from "./sepay-feed.webhook"

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }
const SANDBOX = connectionRecord({ id: "11111111-1111-4111-8111-111111111111", workspaceId: "ws-1", provider: "sepay", sandbox: true })
const LIVE = connectionRecord({ id: "22222222-2222-4222-8222-222222222222", workspaceId: "ws-1", provider: "sepay" })
const KEY = "sbx_key_1"
const NOW = new Date("2026-11-14T02:15:02.000Z")
const ASKED = { content: "NIVO DH1001", amount: 350_000 }

/**
 * THE ONE SEND of every SePay case (owner ruling R62) through the REAL SePay feed controller: the Sandbox doors build the case's body,
 * the poster hands each call to `SepayFeedWebhook.receive` exactly as the HTTP route would (the raw body bytes, the route's connection
 * id, the `x-nivo-sandbox-key` header), the real shared guard proves the sandbox key, and the real SePay reading of the delivered bytes is
 * what the bank feed books. Only the feed's database intake is a double (it records the bytes it was handed).
 */
const world = () => {
    const connections = mock<ConnectionsService>()
    connections.authorize.mockResolvedValue({ role: "owner", displayName: "Lan" })
    connections.find.mockImplementation((_ws, id) => Promise.resolve([SANDBOX, LIVE].find((one) => one.id === id) ?? null))
    connections.sandboxKeyOf.mockImplementation((_ws, id) => Promise.resolve(id === SANDBOX.id ? KEY : null))
    connections.isSandboxKey.mockImplementation((id, presented) => id === SANDBOX.id && presented === KEY)
    const { sandbox, store } = sandboxServiceOf(SANDBOX, LIVE)
    const guard = new SandboxWebhookKeyService(store, { enabled: true }, connections)
    const feed = mock<BankFeedReceiptsService>()
    feed.verifyFeedDelivery.mockResolvedValue(undefined)
    const intake = mock<BankFeedIntakeService>()
    intake.acceptDelivery.mockResolvedValue(undefined)
    const door = new SepayFeedWebhook(feed, intake, guard)
    const reading = new SepayFeedWebhookService(mock<SepayConnectionService>(), mock<FeedWebhookRegistryService>())
    /** What the HTTP route does with one call: the raw bytes, the id the path names, the sandbox header. */
    const route = async (call: SandboxWebhookPost) => {
        const connectionId = call.path.split("/").at(-1) ?? ""
        const rawBody = Buffer.from(JSON.stringify(call.body))
        try {
            const ack = await door.receive(mock<RawBodyRequest<Request>>({ rawBody }), connectionId, undefined, call.headers[SANDBOX_KEY_HEADER])
            return { status: 200, body: ack }
        } catch (cause) {
            return { status: 401, body: { code: (cause as { code?: string }).code } }
        }
    }
    const poster = new RecordingWebhookPoster(route)
    const catalogues = new SandboxCatalogueRegistryService()
    catalogues.register(SEPAY_SANDBOX_CATALOGUE)
    const doors = new ProviderSandboxAccountsService(connections, sandbox, catalogues, poster, { now: () => NOW })
    /** The credits the feed was handed, read by the real SePay reading. */
    const booked = () =>
        intake.acceptDelivery.mock.calls.map(([raw, connection, provider]) => ({
            connection,
            provider,
            reading: reading.read(JSON.parse(String(raw)) as Record<string, unknown>),
        }))
    return { doors, feed, intake, booked, route, sandbox }
}

describe("SePay sandbox cases on the real SePay feed controller (R62)", () => {
    it.each([
        ["SEPAY-1", 1, { amount: 350_000, content: "NIVO DH1001" }],
        ["SEPAY-2", 1, { amount: 349_000, content: "NIVO DH1001" }],
        ["SEPAY-3", 1, { amount: 351_000, content: "NIVO DH1001" }],
        ["SEPAY-4", 1, { amount: 350_000, content: "" }],
        ["SEPAY-5", 1, { amount: 350_000, content: "NIVO DH1001", direction: "debit" }],
        ["SEPAY-6", 2, { amount: 350_000, content: "NIVO DH1001" }],
        ["SEPAY-7", 1, { amount: 350_000, content: "NIVO DH0000" }],
    ])("%s reaches the feed %d time(s) as the credit %j, proven by the sandbox key (no SePay key asked)", async (caseId, times, credit) => {
        const { doors, feed, booked } = world()

        const sent = await doors.send(ACTOR, SANDBOX.id, caseId, ASKED)

        expect(sent.deliveries).toEqual(
            Array.from({ length: times }, () => ({ path: `api/connections/sepay/${SANDBOX.id}`, status: 200, body: PROVIDER_ACK })),
        )
        expect(feed.verifyFeedDelivery).not.toHaveBeenCalled()
        const credits = booked()
        expect(credits).toHaveLength(times)
        for (const one of credits) {
            expect(one).toMatchObject({ connection: SANDBOX.id, provider: "sepay" })
            expect(one.reading).toEqual({
                kind: "transaction",
                credit: expect.objectContaining({ ...credit, eventId: "sepay:9100001", account: "0011004455667", occurredAt: NOW.toISOString() }),
            })
        }
        if (!("direction" in credit)) expect(credits[0]?.reading).not.toMatchObject({ credit: { direction: "debit" } })
    })

    it("prefills the inputs from the agent's latest payment instruction", async () => {
        const { doors, sandbox, booked } = world()
        await sandbox.call(SANDBOX, "transfer", { amountVnd: 120_000, content: "NIVO DH2002" }, { answer: () => ({}) })

        await doors.send(ACTOR, SANDBOX.id, "SEPAY-2")

        expect(booked()[0]?.reading).toMatchObject({ credit: { amount: 119_000, content: "NIVO DH2002" } })
    })

    it("refuses a call for the sandbox account without its key, and a LIVE account still runs SePay's own key proof", async () => {
        const { route, intake, feed } = world()

        await expect(route({ path: `api/connections/sepay/${SANDBOX.id}`, body: { id: 1 }, headers: { [SANDBOX_KEY_HEADER]: "wrong" } })).resolves.toEqual({
            status: 401,
            body: { code: "PROVIDER_SANDBOX_WEBHOOK_KEY_REFUSED" },
        })
        expect(intake.acceptDelivery).not.toHaveBeenCalled()

        await route({ path: `api/connections/sepay/${LIVE.id}`, body: { id: 1 }, headers: { [SANDBOX_KEY_HEADER]: KEY } })
        expect(feed.verifyFeedDelivery).toHaveBeenCalledTimes(1)
    })
})
