// Read services lead the barrel: other capabilities import this barrel while it loads (import cycles), they must already be defined.
export { WorkItemsViewsReadService } from "./work-items-views-read.service"

export { WorkItemsActivityService } from "./work-items-activity.service"
export { workItemsEntities } from "./persistence/entities"
export { WORK_ITEMS_ERROR_KINDS } from "./errors/work-items.error"
export { WORK_ITEMS_MESSAGES } from "./messages/work-items.messages"
export type {
    DecidedPath,
    EvidenceState,
    NewWorkItem,
    Proposal,
    ReasonCode,
    SubjectType,
    WorkItem,
    WorkStatus,
} from "./work-items.contracts"

export { WorkItemsModule } from "./work-items.module"
export { WorkItemsService } from "./work-items.service"
export { WorkInHandService } from "./work-in-hand.service"
export { WorkItemsDashboardReadService } from "./work-items-dashboard-read.service"
export type {
    AgentActionActivity,
    AgentResponseTime,
    AgentWaiting,
    DashboardRange,
    WaitingApproval,
} from "./work-items-dashboard-read.contracts"

export { toProposal } from "./work-items.mapper"
export type { WorkItemRecord } from "./work-items.contracts"


export type { WorkResult } from "./work-items.contracts"
