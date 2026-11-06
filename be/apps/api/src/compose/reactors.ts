import type { DynamicModule } from "@nestjs/common"
import { AgentWakesMessageModule } from "@features/reactors/agent-wakes"
import { AgentSyncMessageModule } from "@features/reactors/agent-sync"
import { BankFeedPollMessageModule } from "@features/reactors/bank-feed-poll"
import { BookingEffectsMessageModule } from "@features/reactors/booking-effects"
import { ContentDraftingMessageModule } from "@features/reactors/content-drafting"
import { InventoryDeductionMessageModule } from "@features/reactors/inventory-deduction"
import { SourceFactsMessageModule } from "@features/reactors/source-facts"
import { AgentGraphApprovalsMessageModule } from "@features/reactors/agent-graph-approvals"
import { VideoScriptingMessageModule } from "@features/reactors/video-scripting"
import { ZaloInboxPollMessageModule } from "@features/reactors/zalo-inbox-poll"

/** The event reactors the api runs: each message module subscribes its consumers to their queues on the event bus. */
export const API_REACTORS: Array<DynamicModule> = [
    AgentGraphApprovalsMessageModule.register({}),
    AgentSyncMessageModule.register({}),
    AgentWakesMessageModule.register({}),
    BankFeedPollMessageModule.register({}),
    BookingEffectsMessageModule.register({}),
    ContentDraftingMessageModule.register({}),
    InventoryDeductionMessageModule.register({}),
    SourceFactsMessageModule.register({}),
    VideoScriptingMessageModule.register({}),
    ZaloInboxPollMessageModule.register({}),
]
