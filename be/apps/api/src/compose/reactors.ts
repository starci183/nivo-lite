import type { DynamicModule } from "@nestjs/common"
import { AgentSyncMessageModule } from "@features/reactors/agent-sync"
import { AutomationTriggersMessageModule } from "@features/reactors/automation-triggers"
import { BankCreditSettlementMessageModule } from "@features/reactors/bank-credit-settlement"
import { BookingEffectsMessageModule } from "@features/reactors/booking-effects"
import { ContentDraftingMessageModule } from "@features/reactors/content-drafting"
import { ContractRenewalMessageModule } from "@features/reactors/contract-renewal"
import { InventoryDeductionMessageModule } from "@features/reactors/inventory-deduction"
import { PaymentReceiptsMessageModule } from "@features/reactors/payment-receipts"
import { SourceFactsMessageModule } from "@features/reactors/source-facts"
import { AgentGraphApprovalsMessageModule } from "@features/reactors/agent-graph-approvals"
import { ThreadOutcomesMessageModule } from "@features/reactors/thread-outcomes"
import { VideoScriptingMessageModule } from "@features/reactors/video-scripting"

/** The event reactors the api runs: each message module subscribes its consumers to their queues on the event bus. */
export const API_REACTORS: Array<DynamicModule> = [
    AgentGraphApprovalsMessageModule.register({}),
    AgentSyncMessageModule.register({}),
    AutomationTriggersMessageModule.register({}),
    BankCreditSettlementMessageModule.register({}),
    BookingEffectsMessageModule.register({}),
    ContentDraftingMessageModule.register({}),
    ContractRenewalMessageModule.register({}),
    InventoryDeductionMessageModule.register({}),
    PaymentReceiptsMessageModule.register({}),
    SourceFactsMessageModule.register({}),
    ThreadOutcomesMessageModule.register({}),
    VideoScriptingMessageModule.register({}),
]
