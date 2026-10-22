import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ApprovalAgentOwners, ApprovalEvents } from "./approval-requests.port"

/** Token of the approval events port; the capability binds the evidence log unless the app root names another owner. */
export const APPROVAL_EVENTS: unique symbol = Symbol("domain.approval-requests.events")

/** Token of the agent owners port; the app root binds it to the agents capability. */
export const APPROVAL_AGENT_OWNERS: unique symbol = Symbol("domain.approval-requests.agent-owners")

/** Injects the approval events port. Parameter type: ApprovalEvents. */
export const InjectApprovalEvents = (): TypedParameterDecorator<ApprovalEvents> =>
    injector<ApprovalEvents>(APPROVAL_EVENTS)

/** Injects the agent owners port. Parameter type: ApprovalAgentOwners. */
export const InjectApprovalAgentOwners = (): TypedParameterDecorator<ApprovalAgentOwners> =>
    injector<ApprovalAgentOwners>(APPROVAL_AGENT_OWNERS)
