import { BankFeedReceiptsService } from "@modules/domain/billing"
import { ConnectionsService } from "@modules/domain/connections"
import { ModulesService } from "@modules/domain/modules"
import { SepayFeedWebhookService } from "@modules/domain/sepay-provider"
import { JobRunnerService, type FencedProcessor } from "@modules/platform/jobs"
import { eachInOrder } from "@modules/platform/primitives"
import { BankFeedDeliveryProcessor } from "../../../features/jobs/bank-feed-delivery/transport/queue/bank-feed-delivery.processor"
import { persistPaymentFeed, type PaymentFeedWorld } from "../../fixtures/builders/payment-feed.builder"
import { API_APP_MODULES } from "../../world/api-app.options"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { cleanFeedReceipts, cleanJobKeys, feedDeliveries, feedRows, type FeedReceiptRow } from "../../world/payment-feed-database.service"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: API_APP_MODULES })

const feed: PaymentFeedWorld = {
    workspaceId: world.id(),
    userId: world.id(),
    agentId: world.id(),
    connectionId: world.id(),
    webhookKey: "test-sepay-webhook-key",
    accountNumber: "0123456789",
}
const db = () => world.db.primary

/** The deliveries the SePay account keeps. */
const deliveries = () => feedRows(db(), feed.connectionId, "sepay.delivery")

/** The bank movements the SePay account keeps. */
const transactions = () => feedRows(db(), feed.connectionId, "sepay.transaction")

/** The amount a bank movement row holds, NaN when the row carries none. */
const amountOf = (row: FeedReceiptRow): number => ("amount" in row.value ? Number(row.value.amount) : Number.NaN)

/** One SePay delivery of a transfer into the workspace account, as SePay posts it (https://docs.sepay.vn). */
const sepayBody = (id: number, amount: number, content: string): Buffer =>
    Buffer.from(
        JSON.stringify({
            id,
            gateway: "MBBank",
            transactionDate: "2026-11-05 14:02:37",
            accountNumber: feed.accountNumber,
            code: null,
            content,
            transferType: "in",
            transferAmount: amount,
            accumulated: 9_000_000,
            subAccount: null,
            referenceCode: `FT${id}`,
            description: `BankAPINotify ${content}`,
        }),
    )

/** The outbox rows already handed to the processor: each runs once, as the relay delivers it once. */
const delivered = new Set<string>()

const runQueued = async (processor: FencedProcessor): Promise<void> => {
    const fresh = (await feedDeliveries(db(), feed.connectionId)).filter((job) => !delivered.has(job.id))
    await eachInOrder(fresh, async (job) => {
        delivered.add(job.id)
        await world.resolve(JobRunnerService).run(processor, {
            id: job.id,
            queue: job.queue,
            job: job.name,
            payload: job.payload,
            attempt: 1,
            signal: new AbortController().signal,
        })
    })
}

/** The webhook path after the HTTP door: the key is proven against the connection digest, the receipt is recorded, the delivery job books it. */
const deliver = async (body: Buffer, key: string = feed.webhookKey): Promise<void> => {
    const receipts = world.resolve(BankFeedReceiptsService)
    await receipts.verifyFeedDelivery(`Apikey ${key}`, feed.connectionId, body, "sepay")
    await receipts.acceptFeedDelivery(body, feed.connectionId, "sepay")
    await runQueued(world.resolve(BankFeedDeliveryProcessor))
}

beforeAll(async () => {
    world.cleanup(async () => {
        await cleanJobKeys(db(), [...delivered])
        await cleanFeedReceipts(db(), feed.connectionId)
        await removeWorkspace(db(), feed.workspaceId)
        await removeAuthUsers(db(), [feed.userId])
    })
    // The world compiles the api without booting it: the SePay feed webhook joins the feed registry as it does at module init.
    world.resolve(SepayFeedWebhookService).onModuleInit()
    await world.resolve(ModulesService).sync()
    await persistPaymentFeed(db(), world.resolve(ConnectionsService), feed)
})

describe("the SePay webhook inbound keeps raw sepay.transaction rows and no business record", () => {
    it("keeps exactly one raw row for a signed delivery, with the reference as SePay sent it", async () => {
        await deliver(sepayBody(910_001, 5_000_000, "NIVO8F3K2 chuyen tien"))

        // The receipt is one finished `sepay.delivery` row of the connection's account; the connection is the account, not a value member.
        const receipts = await deliveries()
        expect(receipts).toHaveLength(1)
        expect(receipts[0]?.processedAt).toBeInstanceOf(Date)
        expect(receipts[0]?.value).toEqual({
            deliveryId: receipts[0]?.key,
            credits: [expect.objectContaining({ amount: 5_000_000 })],
        })
        // The movement is one `sepay.transaction` row, keyed by SePay's own transaction id.
        const movements = await transactions()
        expect(movements).toHaveLength(1)
        expect(movements[0]?.value).toMatchObject({
            amount: 5_000_000,
            direction: "credit",
            content: "NIVO8F3K2 chuyen tien",
            account: feed.accountNumber,
            source: "webhook",
        })
    })

    it("ignores a replay of the same delivery: still one raw row, and no second delivery row", async () => {
        const before = await deliveries()
        await deliver(sepayBody(910_001, 5_000_000, "NIVO8F3K2 chuyen tien"))

        expect(await deliveries()).toEqual(before)
        expect(await transactions()).toHaveLength(1)
    })

    it("keeps a second raw row for another transfer", async () => {
        await deliver(sepayBody(910_002, 1_200_000, "NIVO9X1Z2 chuyen tien"))

        const amounts = (await transactions()).map((row) => amountOf(row)).toSorted((a, b) => a - b)
        expect(amounts).toEqual([1_200_000, 5_000_000])
    })

    it("refuses a delivery signed with another key and keeps nothing for it", async () => {
        await expect(deliver(sepayBody(910_003, 777_000, "NIVO0000 chuyen tien"), "another-key")).rejects.toBeDefined()

        expect((await transactions()).some((row) => amountOf(row) === 777_000)).toBe(false)
    })
})
