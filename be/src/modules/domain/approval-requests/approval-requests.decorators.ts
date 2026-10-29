import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ApprovalAgentOwners } from "./approval-requests.port"

/** Token of the agent owners port; the app root binds it to the agents capability. */
export const APPROVAL_AGENT_OWNERS: unique symbol = Symbol("domain.approval-requests.agent-owners")

/** Injects the agent owners port. Parameter type: ApprovalAgentOwners. */
export const InjectApprovalAgentOwners = (): TypedParameterDecorator<ApprovalAgentOwners> =>
    injector<ApprovalAgentOwners>(APPROVAL_AGENT_OWNERS)
