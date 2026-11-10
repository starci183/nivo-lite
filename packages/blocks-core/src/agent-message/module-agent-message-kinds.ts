import { coreAgentMessageKinds } from "./agent-message-kinds"
import type { AgentMessageKind } from "./agent-message-kinds"
import { accountingAgentMessageKinds } from "../modules/accounting/agent-message-kinds"
import { salesAgentMessageKinds } from "../modules/sales/agent-message-kinds"

/**
 * Every kind a message may name: the core's, then the kinds each module declares from its own folder (media, invoice, payment request,
 * report...). A module adds its list to this array and the core never names it.
 */
export const agentMessageKinds: ReadonlyArray<AgentMessageKind> = [
    ...coreAgentMessageKinds,
    ...salesAgentMessageKinds,
    ...accountingAgentMessageKinds,
]
