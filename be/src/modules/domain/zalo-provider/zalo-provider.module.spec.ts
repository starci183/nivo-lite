import { MessageInboxPollerRegistry } from "@modules/domain/provider-registry"
import { MessageInboxPollSources } from "./message-inbox-poll-sources.service"
import { ZaloInboxPoller } from "./zalo-inbox-poller.service"
import { ZaloInboxPollTriggerService } from "./zalo-poll-trigger.service"
import { ZaloInboxPollService } from "./zalo-poll.service"
import { ZaloProviderModule } from "./zalo-provider.module"

describe("ZaloProviderModule", () => {
    it("provides and exports the poller, the poll, its trigger and the scheduler source", () => {
        const registered = ZaloProviderModule.register({})
        const providers = [ZaloInboxPoller, ZaloInboxPollService, ZaloInboxPollTriggerService, MessageInboxPollSources]

        expect(registered.providers).toEqual(expect.arrayContaining(providers))
        expect(registered.exports).toEqual(providers)
    })

    it("registers its inbox poller under the Zalo provider key when the app boots", () => {
        const registry = new MessageInboxPollerRegistry()
        const poller = { provider: "zalo_oa" } as ZaloInboxPoller

        new ZaloProviderModule(registry, poller).onModuleInit()

        expect(registry.of("zalo_oa")).toBe(poller)
    })
})
