import { AgentsService } from "@modules/domain/agents"
import { UnboundBookingToolsService, UnboundKnowledgeSearchService } from "@modules/domain/agent-tools"
import {
    ApprovalRequesterService,
    UnboundDecisionEventsService,
    UnboundLeadGenFlowService,
    UnboundPaymentReceiptsService,
} from "@modules/domain/decisions"
import {
    ConversationLeadsService,
    HandoffToolService,
    InboundStatusService,
    LeadWriterService,
    OutboundAccessService,
} from "@modules/domain/work-performers"
import { ToolTokenService } from "@modules/integrations/openclaw"

/** The ports the agent-tools capability reaches the rest of the app through. */
export const AGENT_TOOLS_PORTS = {
    knowledgeSearch: UnboundKnowledgeSearchService,
    leadWriter: LeadWriterService,
    bookingTools: UnboundBookingToolsService,
    approvalRequester: ApprovalRequesterService,
    handoffTool: HandoffToolService,
    conversationLeads: ConversationLeadsService,
    toolTokens: ToolTokenService,
}

/** The ports the decisions capability reaches the rest of the app through. */
export const DECISIONS_PORTS = {
    agentDirectory: AgentsService,
    inboundEventStatus: InboundStatusService,
    decisionEvents: UnboundDecisionEventsService,
    paymentReceipts: UnboundPaymentReceiptsService,
    leadGenFlow: UnboundLeadGenFlowService,
    outboundAccessGate: OutboundAccessService,
}
