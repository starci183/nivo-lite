import { coreAgentMessageKinds, type AgentMessageKind } from "@nivo-lite/agent-sdk/team-chat"
import { accountingAgentMessageKinds } from "../../agents/sales/ledger/agent-message-kinds"
import { salesAgentMessageKinds } from "./sales-agent-message-kinds"

/**
 * Every kind a message may name: the core's, then the kinds each module declares from its own folder (media, invoice, payment request,
 * report...). A module adds its list to this array and the core never names it.
 */
export const agentMessageKinds: ReadonlyArray<AgentMessageKind> = [
    ...coreAgentMessageKinds,
    ...salesAgentMessageKinds,
    ...accountingAgentMessageKinds,
]
