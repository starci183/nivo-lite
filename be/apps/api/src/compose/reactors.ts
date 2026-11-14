import type { DynamicModule } from "@nestjs/common"
import { AgentWakesMessageModule } from "@features/reactors/agent-wakes"
import { BankFeedPollMessageModule } from "@features/reactors/bank-feed-poll"
import { SourceFactsMessageModule } from "@features/reactors/source-facts"
import { ZaloInboxPollMessageModule } from "@features/reactors/zalo-inbox-poll"

/** The event reactors the api runs: each message module subscribes its consumers to their queues on the event bus. */
export const API_REACTORS: Array<DynamicModule> = [
    AgentWakesMessageModule.register({}),
    BankFeedPollMessageModule.register({}),
    SourceFactsMessageModule.register({}),
    ZaloInboxPollMessageModule.register({}),
]
