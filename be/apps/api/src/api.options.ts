import { AgentsService } from "@modules/domain/agents"
import { KnowledgeSearchToolService } from "@modules/domain/agent-knowledge"
import { TurnGatewayToolsService, TurnHandoffService } from "@modules/domain/customer-turns"
import { ApprovalRequesterService, ModuleApprovalGateService, ModulePerformersService } from "@modules/domain/decisions"
import { AutomationBusinessEventsService, AutomationPaymentReceiptsService } from "@modules/domain/automations"
import {
    BookingToolsService,
    ConversationLeadsService,
    HandoffToolService,
    InboundStatusService,
    LeadWriterService,
    OutboundAccessService,
} from "@modules/domain/work-performers"
import { LeadReadService } from "@modules/domain/leads"
import { LeadFlowChainService } from "@modules/domain/lead-flows"
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

/** The delivery of booking notices through the customer's existing conversation and channel. */
export const BOOKING_PORTS = { notifier: BookingNotifierService }

/** The ports the agent-tools capability reaches the rest of the app through. */
export const AGENT_TOOLS_PORTS = {
    knowledgeSearch: KnowledgeSearchToolService,
    leadWriter: LeadWriterService,
    bookingTools: BookingToolsService,
    approvalRequester: ApprovalRequesterService,
    handoffTool: HandoffToolService,
    conversationLeads: ConversationLeadsService,
    gatewayTools: TurnGatewayToolsService,
    agentHandoff: TurnHandoffService,
    toolTokens: ToolTokenService,
}

/** The ports the decisions capability reaches the rest of the app through. */
export const DECISIONS_PORTS = {
    agentDirectory: AgentsService,
    inboundEventStatus: InboundStatusService,
    decisionEvents: AutomationBusinessEventsService,
    paymentReceipts: AutomationPaymentReceiptsService,
    leadDirectory: LeadReadService,
    leadGenFlow: LeadFlowChainService,
    outboundAccessGate: OutboundAccessService,
}

export type { ApiOptions } from "./api.env"
