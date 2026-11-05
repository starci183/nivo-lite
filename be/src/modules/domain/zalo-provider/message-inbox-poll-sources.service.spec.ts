import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PollSourceRegistryService } from "@modules/domain/connection-poll"
import { MessageInboxPollerRegistryService } from "@modules/domain/provider-registry"
import type { MessageInboxPoller } from "@modules/domain/provider-registry"
import { MessageInboxPollSourcesService } from "./message-inbox-poll-sources.service"

const limits = { ratePerSecond: 2, burst: 4, concurrency: 2 }

const build = async () => {
    const poller = mock<MessageInboxPoller>({ provider: "zalo_oa", limits })
    const pollers = mock<MessageInboxPollerRegistryService>()
    pollers.all.mockReturnValue([poller])
    pollers.of.mockImplementation((provider) => (provider === "zalo_oa" ? poller : undefined))
    const registry = mock<PollSourceRegistryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            MessageInboxPollSourcesService,
            { provide: PollSourceRegistryService, useValue: registry },
            { provide: MessageInboxPollerRegistryService, useValue: pollers },
        ],
    }).compile()
    return { sources: moduleRef.get(MessageInboxPollSourcesService), registry, poller }
}

describe("MessageInboxPollSourcesService", () => {
    it("joins the scheduler's registry once the app has booted", async () => {
        const { sources, registry } = await build()

        sources.onApplicationBootstrap()

        expect(registry.add).toHaveBeenCalledTimes(1)
        expect(registry.add).toHaveBeenCalledWith(sources)
    })

    it("offers the providers that registered an inbox poller", async () => {
        const { sources } = await build()

        expect(sources.providers()).toEqual(["zalo_oa"])
    })

    it("offers nothing for a provider that registered none", async () => {
        const { sources } = await build()

        expect(sources.sourceOf("telegram")).toBeUndefined()
    })

    it("offers the poller itself with its limits and its error classes", async () => {
        const { sources, poller } = await build()
        poller.classify.mockReturnValue({ kind: "transient" })

        const source = sources.sourceOf("zalo_oa")

        expect(source?.poller).toBe(poller)
        expect(source?.limits).toBe(limits)
        expect(source?.classify(new Error("x"))).toEqual({ kind: "transient" })
    })
})
