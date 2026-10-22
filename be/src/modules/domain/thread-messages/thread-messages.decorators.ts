import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentRules, ApprovalGate } from "./thread-messages.port"

/** Token of the approval gate port; the app root binds it to the approval requests capability. */
export const APPROVAL_GATE: unique symbol = Symbol("domain.thread-messages.approval-gate")

/** Token of the agent rules port; the app root binds it to the agents capability. */
export const AGENT_RULES: unique symbol = Symbol("domain.thread-messages.agent-rules")

/** Injects the approval gate. Parameter type: ApprovalGate. */
export const InjectApprovalGate = (): TypedParameterDecorator<ApprovalGate> => injector<ApprovalGate>(APPROVAL_GATE)

/** Injects the agent rules. Parameter type: AgentRules. */
export const InjectAgentRules = (): TypedParameterDecorator<AgentRules> => injector<AgentRules>(AGENT_RULES)
