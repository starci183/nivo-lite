import { AgentsService } from "@modules/domain/agents"
import { KnowledgeSearchToolService } from "@modules/domain/agent-knowledge"
import { TurnGatewayToolsService, TurnHandoffService } from "@modules/domain/customer-turns"
import { ApprovalRequesterService, ModuleApprovalGateService, ModulePerformersService } from "@modules/domain/decisions"
import {
    BookingToolsService,
    ConversationLeadsService,
    InboundStatusService,
    LeadWriterService,
    OutboundAccessService,
} from "@modules/domain/work-performers"
import { LeadReadService } from "@modules/domain/leads"
import { LeadFlowChainService } from "@modules/domain/lead-flows"
import { ModulesService } from "@modules/domain/modules"
import { ThreadWorkLinksReadService } from "@modules/domain/thread-work"
import { WorkChainsHistoryReadService } from "@modules/domain/work-chains"
import { WorkThreadsLeadsReadService } from "@modules/domain/work-threads"
import { ToolTokenService } from "@modules/integrations/openclaw"
import { ModuleTextGeneratorService } from "@modules/domain/ai-generations"
import { ModuleOutboundMailService } from "@modules/domain/email-messages"
import type { ModuleOpsPorts } from "@modules/domain/module-ops"
import { BookingNotifierService } from "@modules/domain/booking-ports"
import { DataSourcesError, DataSourcesErrorCode } from "@modules/integrations/data-sources"
import type { TelegramUserErrors } from "@modules/integrations/telegram-user"

/** The existing data-sources error family used by the personal Telegram integration. */
export const TELEGRAM_USER_ERRORS: TelegramUserErrors = {
    rejected: (detail, cause) =>
        new DataSourcesError({ code: DataSourcesErrorCode.Rejected, params: { detail }, cause }),
    unavailable: (detail, cause) =>
        new DataSourcesError({ code: DataSourcesErrorCode.Unavailable, params: { detail }, cause }),
    isError: (error): error is DataSourcesError => error instanceof DataSourcesError,
}

/** The ports the business modules (hiring, shifts, inventory) work through: the real gate, mailer and text generator. */
export const MODULE_OPS_PORTS: ModuleOpsPorts = {
    performers: ModulePerformersService,
    approvalGate: ModuleApprovalGateService,
    outboundMail: ModuleOutboundMailService,
    textGenerator: ModuleTextGeneratorService,
}

/** The delivery of booking notices through the customer's existing conversation and channel, by port name. */
interface BookingPorts {
    /** The notifier port. */
    readonly notifier: typeof BookingNotifierService
}

/** The delivery of booking notices through the customer's existing conversation and channel. */
export const BOOKING_PORTS: BookingPorts = { notifier: BookingNotifierService }

/** The ports the agent-tools capability reaches the rest of the app through, by port name. */
interface AgentToolsPorts {
    /** The knowledgeSearch port. */
    readonly knowledgeSearch: typeof KnowledgeSearchToolService
    /** The leadWriter port. */
    readonly leadWriter: typeof LeadWriterService
    /** The bookingTools port. */
    readonly bookingTools: typeof BookingToolsService
    /** The approvalRequester port. */
    readonly approvalRequester: typeof ApprovalRequesterService
    /** The conversationLeads port. */
    readonly conversationLeads: typeof ConversationLeadsService
    /** The gatewayTools port. */
    readonly gatewayTools: typeof TurnGatewayToolsService
    /** The agentHandoff port. */
    readonly agentHandoff: typeof TurnHandoffService
    /** The toolTokens port. */
    readonly toolTokens: typeof ToolTokenService
}

/** The ports the agent-tools capability reaches the rest of the app through. */
export const AGENT_TOOLS_PORTS: AgentToolsPorts = {
    knowledgeSearch: KnowledgeSearchToolService,
    leadWriter: LeadWriterService,
    bookingTools: BookingToolsService,
    approvalRequester: ApprovalRequesterService,
    conversationLeads: ConversationLeadsService,
    gatewayTools: TurnGatewayToolsService,
    agentHandoff: TurnHandoffService,
    toolTokens: ToolTokenService,
}

/** The ports the decisions capability reaches the rest of the app through, by port name. */
interface DecisionsPorts {
    /** The agentDirectory port. */
    readonly agentDirectory: typeof AgentsService
    /** The inboundEventStatus port. */
    readonly inboundEventStatus: typeof InboundStatusService
    /** The leadDirectory port. */
    readonly leadDirectory: typeof LeadReadService
    /** The workItemLeads port. */
    readonly workItemLeads: typeof LeadReadService
    /** The leadGenFlow port. */
    readonly leadGenFlow: typeof LeadFlowChainService
    /** The moduleCatalog port. */
    readonly moduleCatalog: typeof ModulesService
    /** The outboundAccessGate port. */
    readonly outboundAccessGate: typeof OutboundAccessService
    /** The threadWorkHistory port. */
    readonly threadWorkHistory: typeof ThreadWorkLinksReadService
    /** The workChainsHistory port. */
    readonly workChainsHistory: typeof WorkChainsHistoryReadService
    /** The workThreadsHistory port. */
    readonly workThreadsHistory: typeof WorkThreadsLeadsReadService
}

/** The ports the decisions capability reaches the rest of the app through. */
export const DECISIONS_PORTS: DecisionsPorts = {
    agentDirectory: AgentsService,
    inboundEventStatus: InboundStatusService,
    leadDirectory: LeadReadService,
    workItemLeads: LeadReadService,
    leadGenFlow: LeadFlowChainService,
    moduleCatalog: ModulesService,
    outboundAccessGate: OutboundAccessService,
    threadWorkHistory: ThreadWorkLinksReadService,
    workChainsHistory: WorkChainsHistoryReadService,
    workThreadsHistory: WorkThreadsLeadsReadService,
}

export type { ApiOptions } from "./api.env"
