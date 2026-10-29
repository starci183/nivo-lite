export { AutomationTickService } from "./automation-tick.service"
export { AutomationExtensionsService } from "./automation-extensions.service"
export type { ExecutorContext, ExecutorPayload } from "./automation-ports.contracts"
export type {
    AutomationGate,
    AutomationOffice,
    AutomationOwnerChat,
    AutomationText,
    AutomationTextRequest,
    GeneratedText,
    AutomationRecords,
    AutomationEvidenceEntry,
    FollowUp,
    GateOutcome,
    GateSubmission,
    GoogleAccount,
    AutomationNewLead,
    OptionalLead,
} from "./automation-ports.contracts"
export type {
    AutomationInstallationRow,
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
export {
    AUTOMATION_GATE,
    AUTOMATION_OFFICE,
    AUTOMATION_OWNER_CHAT,
    AUTOMATION_RECORDS,
    AUTOMATION_TEXT,
} from "./automations.decorators"
export { AutomationsModule } from "./automations.module"
export { AutomationsService } from "./automations.service"
export { AUTOMATIONS_ERROR_KINDS, AutomationsError, AutomationsErrorCode } from "./errors/automations.error"
export { AUTOMATIONS_MESSAGES } from "./messages/automations.messages"
export type { ShopPatterns } from "./policies/context.policy"
export { AutomationReactionsService } from "./automation-reactions.service"
