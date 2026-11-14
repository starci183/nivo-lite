import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PollSourceRegistryService } from "@modules/domain/connection-poll"
import { MessageInboxPollSourcesService } from "./message-inbox-poll-sources.service"
import { ZaloPolledInboxService } from "./zalo-polled-inbox.service"

const limits = { ratePerSecond: 2, burst: 4, concurrency: 2 }

const build = async () => {
    const zalo = mock<ZaloPolledInboxService>({ provider: "zalo_oa", limits })
    const registry = mock<PollSourceRegistryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            MessageInboxPollSourcesService,
            { provide: PollSourceRegistryService, useValue: registry },
            { provide: ZaloPolledInboxService, useValue: zalo },
        ],
    }).compile()
    return { sources: moduleRef.get(MessageInboxPollSourcesService), registry, zalo }
}

describe("MessageInboxPollSourcesService", () => {
    it("joins the scheduler's registry once the app has booted", async () => {
        const { sources, registry } = await build()

        sources.onApplicationBootstrap()

        expect(registry.add).toHaveBeenCalledTimes(1)
        expect(registry.add).toHaveBeenCalledWith(sources)
    })

    it("offers the Zalo inbox poll", async () => {
        const { sources } = await build()

        expect(sources.providers()).toEqual(["zalo_oa"])
    })

    it("offers nothing for a provider whose inbox is not polled", async () => {
        const { sources } = await build()

        expect(sources.sourceOf("telegram")).toBeUndefined()
    })

    it("offers the polled inbox (the provider's reader with the intake's store) with its limits and error classes", async () => {
        const { sources, zalo } = await build()
        zalo.classify.mockReturnValue({ kind: "transient" })

        const source = sources.sourceOf("zalo_oa")

        expect(source?.poller).toBe(zalo)
        expect(source?.limits).toBe(limits)
        expect(source?.classify(new Error("x"))).toEqual({ kind: "transient" })
    })
})
