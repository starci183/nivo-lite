import type { AgentSummary } from "@modules/domain/agents"
import type { EventRecordRow } from "@modules/domain/events"
import type { ExecutionRecordRow } from "@modules/domain/executions"
import type { ResponsibilityRecord } from "@modules/domain/responsibilities"
import type { LeadView } from "@modules/domain/leads"

/** The owned records that make up a customer's journey. */
export interface LeadJourneyData {
    /** The requested lead. */
    readonly lead: LeadView
    /** The steps, oldest first. */
    readonly responsibilities: ReadonlyArray<ResponsibilityRecord>
    /** Approval cards of those steps, oldest first. */
    readonly executions: ReadonlyArray<ExecutionRecordRow>
    /** The evidence log, newest first. */
    readonly events: ReadonlyArray<EventRecordRow>
    /** Available agent owners, in creation order. */
    readonly agents: ReadonlyArray<AgentSummary>
}
