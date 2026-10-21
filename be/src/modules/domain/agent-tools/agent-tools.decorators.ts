import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type {
    AgentHandoff,
    ApprovalRequester,
    BookingTools,
    ConversationLeads,
    GatewayTools,
    HandoffTool,
    KnowledgeSearch,
    LeadWriter,
    ToolTokens,
} from "./agent-tools.port"

/** Token of the knowledge search port. */
export const KNOWLEDGE_SEARCH: unique symbol = Symbol("domain.agent-tools.knowledge-search")

/** Token of the lead writer port. */
export const LEAD_WRITER: unique symbol = Symbol("domain.agent-tools.lead-writer")

/** Token of the booking tools port. */
export const BOOKING_TOOLS: unique symbol = Symbol("domain.agent-tools.booking-tools")

/** Token of the approval requester port. */
export const APPROVAL_REQUESTER: unique symbol = Symbol("domain.agent-tools.approval-requester")

/** Token of the handoff port. */
export const HANDOFF_TOOL: unique symbol = Symbol("domain.agent-tools.handoff-tool")

/** Token of the conversation leads port. */
export const CONVERSATION_LEADS: unique symbol = Symbol("domain.agent-tools.conversation-leads")

/** Token of the connector meta-tools port. */
export const GATEWAY_TOOLS: unique symbol = Symbol("domain.agent-tools.gateway-tools")

/** Token of the agent hand-off port. */
export const AGENT_HANDOFF: unique symbol = Symbol("domain.agent-tools.agent-handoff")

/** Token of the tool tokens port. */
export const TOOL_TOKENS: unique symbol = Symbol("domain.agent-tools.tool-tokens")

/** Injects the tool tokens port. Parameter type: ToolTokens. */
export const InjectToolTokens = (): TypedParameterDecorator<ToolTokens> => injector<ToolTokens>(TOOL_TOKENS)

/** Injects the knowledge search port. Parameter type: KnowledgeSearch. */
export const InjectKnowledgeSearch = (): TypedParameterDecorator<KnowledgeSearch> =>
    injector<KnowledgeSearch>(KNOWLEDGE_SEARCH)

/** Injects the lead writer port. Parameter type: LeadWriter. */
export const InjectLeadWriter = (): TypedParameterDecorator<LeadWriter> => injector<LeadWriter>(LEAD_WRITER)

/** Injects the booking tools port. Parameter type: BookingTools. */
export const InjectBookingTools = (): TypedParameterDecorator<BookingTools> => injector<BookingTools>(BOOKING_TOOLS)

/** Injects the approval requester port. Parameter type: ApprovalRequester. */
export const InjectApprovalRequester = (): TypedParameterDecorator<ApprovalRequester> =>
    injector<ApprovalRequester>(APPROVAL_REQUESTER)

/** Injects the handoff port. Parameter type: HandoffTool. */
export const InjectHandoffTool = (): TypedParameterDecorator<HandoffTool> => injector<HandoffTool>(HANDOFF_TOOL)

/** Injects the conversation leads port. Parameter type: ConversationLeads. */
export const InjectConversationLeads = (): TypedParameterDecorator<ConversationLeads> =>
    injector<ConversationLeads>(CONVERSATION_LEADS)

/** Injects the connector meta-tools port. Parameter type: GatewayTools. */
export const InjectGatewayTools = (): TypedParameterDecorator<GatewayTools> => injector<GatewayTools>(GATEWAY_TOOLS)

/** Injects the agent hand-off port. Parameter type: AgentHandoff. */
export const InjectAgentHandoff = (): TypedParameterDecorator<AgentHandoff> => injector<AgentHandoff>(AGENT_HANDOFF)
