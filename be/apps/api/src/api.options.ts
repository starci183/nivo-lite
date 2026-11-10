import { AgentsService } from "@modules/domain/agents"
import { ModuleApprovalGateService, ModulePerformersService } from "@modules/domain/decisions"
import { InboundStatusService, OutboundAccessService } from "@modules/domain/work-performers"
import { ModulesService } from "@modules/domain/modules"
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

/** The ports the decisions capability reaches the rest of the app through, by port name. */
interface DecisionsPorts {
    /** The agentDirectory port. */
    readonly agentDirectory: typeof AgentsService
    /** The inboundEventStatus port. */
    readonly inboundEventStatus: typeof InboundStatusService
    /** The moduleCatalog port. */
    readonly moduleCatalog: typeof ModulesService
    /** The outboundAccessGate port. */
    readonly outboundAccessGate: typeof OutboundAccessService
}

/** The ports the decisions capability reaches the rest of the app through. */
export const DECISIONS_PORTS: DecisionsPorts = {
    agentDirectory: AgentsService,
    inboundEventStatus: InboundStatusService,
    moduleCatalog: ModulesService,
    outboundAccessGate: OutboundAccessService,
}

export type { ApiOptions } from "./api.env"
