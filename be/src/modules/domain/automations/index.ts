export { AutomationTickService } from "./automation-tick.service"
export type {
    AutomationGate,
    AutomationOffice,
    AutomationRecords,
    GateOutcome,
    GoogleAccount,
} from "./automation-ports.contracts"
export type {
    InstallationRow,
    OverviewRows,
    ShopFacts,
    ShopWithHours,
    AutomationCard,
    AutomationRunView,
    AutomationSuggestion,
    AutomationsOverview,
    BodyProposal,
    BusinessEventInput,
    PipelinePatch,
} from "./automations.contracts"
export { AUTOMATION_GATE, AUTOMATION_OFFICE, AUTOMATION_RECORDS } from "./automations.decorators"
export { AutomationsModule } from "./automations.module"
export { AutomationsService } from "./automations.service"
export { BusinessEventsService } from "./business-events.service"
export { AUTOMATIONS_ERROR_KINDS, AutomationsError, AutomationsErrorCode } from "./errors/automations.error"
export { AUTOMATIONS_MESSAGES } from "./messages/automations.messages"
export type { ShopPatterns } from "./policies/context.policy"
