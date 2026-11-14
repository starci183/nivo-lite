import { coreAgentMessageViews, type AgentMessageView } from "./agent-message-views"
import { accountingAgentMessageViews } from "../sales/ledger/accounting-agent-message-views"
import { salesAgentMessageViews } from "../sales/sales-agent-message-views"

/**
 * Every view the message card may use: the core's, then the views each module registers for its own kinds from its own folder. A
 * module adds its list to this array and the core never names it.
 */
export const agentMessageViews: ReadonlyArray<AgentMessageView> = [
    ...coreAgentMessageViews,
    ...salesAgentMessageViews,
    ...accountingAgentMessageViews,
]
