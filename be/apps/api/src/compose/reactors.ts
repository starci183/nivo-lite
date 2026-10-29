import type { DynamicModule } from "@nestjs/common"
import { AgentSyncMessageModule } from "@features/reactors/agent-sync"
import { BookingEffectsMessageModule } from "@features/reactors/booking-effects"
import { ContractRenewalMessageModule } from "@features/reactors/contract-renewal"
import { InventoryDeductionMessageModule } from "@features/reactors/inventory-deduction"
import { SourceFactsMessageModule } from "@features/reactors/source-facts"
import { ThreadOutcomesMessageModule } from "@features/reactors/thread-outcomes"
import { VideoScriptingMessageModule } from "@features/reactors/video-scripting"

/** The event reactors the api runs: each message module subscribes its consumers to their queues on the event bus. */
export const API_REACTORS: Array<DynamicModule> = [
    AgentSyncMessageModule.register({}),
    BookingEffectsMessageModule.register({}),
    ContractRenewalMessageModule.register({}),
    InventoryDeductionMessageModule.register({}),
    SourceFactsMessageModule.register({}),
    ThreadOutcomesMessageModule.register({}),
    VideoScriptingMessageModule.register({}),
]
