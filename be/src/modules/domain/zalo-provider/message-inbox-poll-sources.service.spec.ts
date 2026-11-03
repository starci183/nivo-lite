import { mock } from "@starci/jest-preset"
import { PollSourceRegistry } from "@modules/domain/connection-poll"
import { MessageInboxPollerRegistry } from "@modules/domain/provider-registry"
import type { MessageInboxPoller } from "@modules/domain/provider-registry"
import { MessageInboxPollSources } from "./message-inbox-poll-sources.service"

const limits = { ratePerSecond: 2, burst: 4, concurrency: 2 }

const build = () => {
    const pollers = new MessageInboxPollerRegistry()
    const poller = Object.assign(mock<MessageInboxPoller>(), { provider: "zalo_oa", limits })
    pollers.register(poller)
    const registry = new PollSourceRegistry()
    return { sources: new MessageInboxPollSources(registry, pollers), registry, poller }
}

describe("MessageInboxPollSources", () => {
    it("joins the scheduler's registry once the app has booted", () => {
        const { sources, registry } = build()

        sources.onApplicationBootstrap()

        expect(registry.providers()).toEqual(["zalo_oa"])
    })

    it("offers the providers that registered an inbox poller", () => {
        expect(build().sources.providers()).toEqual(["zalo_oa"])
    })

    it("offers nothing for a provider that registered none", () => {
        expect(build().sources.sourceOf("telegram")).toBeUndefined()
    })

    it("offers the poller itself with its limits and its error classes", () => {
        const { sources, poller } = build()
        poller.classify.mockReturnValue({ kind: "transient" })

        const source = sources.sourceOf("zalo_oa")

        expect(source?.poller).toBe(poller)
        expect(source?.limits).toBe(limits)
        expect(source?.classify(new Error("x"))).toEqual({ kind: "transient" })
    })
})
