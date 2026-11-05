import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PollSourceRegistryService } from "@modules/domain/connection-poll"
import { BankFeedPollerRegistryService } from "@modules/domain/provider-registry"
import type { BankFeedPoller } from "@modules/domain/provider-registry"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { BankFeedPollSourcesService } from "./bank-feed-poll-sources.service"
import { BankFeedReceiptsService } from "./bank-feed-receipts.service"

const limits = { ratePerSecond: 2, burst: 2, concurrency: 1 }
const connection = connectionRecord()

const build = async () => {
    const poller = Object.assign(mock<BankFeedPoller>(), {
        provider: "sepay",
        inboxProvider: "sepay-feed" as const,
        limits,
    })
    const feed = mock<BankFeedReceiptsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankFeedPollSourcesService,
            PollSourceRegistryService,
            BankFeedPollerRegistryService,
            { provide: BankFeedReceiptsService, useValue: feed },
        ],
    }).compile()
    moduleRef.get(BankFeedPollerRegistryService).register(poller)
    return {
        sources: moduleRef.get(BankFeedPollSourcesService),
        registry: moduleRef.get(PollSourceRegistryService),
        poller,
        feed,
    }
}

describe("BankFeedPollSourcesService", () => {
    it("joins the scheduler's registry once the app has booted", async () => {
        const { sources, registry } = await build()

        sources.onApplicationBootstrap()

        expect(registry.providers()).toEqual(["sepay"])
    })

    it("offers the bank providers that registered a poller", async () => {
        expect((await build()).sources.providers()).toEqual(["sepay"])
    })

    it("offers nothing for a provider that registered none", async () => {
        expect((await build()).sources.sourceOf("casso")).toBeUndefined()
    })

    it("offers the limits, the error classes and the reader of the provider with the shared feed store", async () => {
        const { sources, poller, feed } = await build()
        poller.classify.mockReturnValue({ kind: "auth_failed" })
        poller.fetch.mockResolvedValue({ kind: "skipped", reason: "no_token" })
        feed.acceptPolledCredit.mockResolvedValue(true)
        const window = { from: new Date(0), to: undefined, limit: 10 }
        const credit = {
            deliveryId: "c-1:sepay:9",
            credit: { amount: 5000, content: "x", eventId: "sepay:9", fallbackBankName: "VCB" },
        }

        const source = sources.sourceOf("sepay")

        expect(source?.limits).toBe(limits)
        expect(source?.classify(new Error("x"))).toEqual({ kind: "auth_failed" })
        await expect(source?.poller.fetch(connection, window)).resolves.toEqual({ kind: "skipped", reason: "no_token" })
        await expect(source?.poller.store(connection, credit)).resolves.toBe(true)
        expect(poller.fetch).toHaveBeenCalledWith(connection, window)
        expect(feed.acceptPolledCredit).toHaveBeenCalledWith("c-1", "sepay-feed", "c-1:sepay:9", credit.credit)
    })
})
