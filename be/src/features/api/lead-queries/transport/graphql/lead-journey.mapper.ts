import type { LeadJourneyData } from "@modules/domain/lead-views"
import type { LeadJourneyRequest } from "../../application/lead-journey.contracts"
import type { LeadJourneyInput } from "./dto/lead-journey.input"
import type { LeadJourneyType } from "./dto/lead-journey.type"
import { toLeadRecordType } from "./lead-record.mapper"

/** Maps the selected workspace and requested lead to the journey query. */
export const toLeadJourneyRequest = (workspaceId: string, input: LeadJourneyInput): LeadJourneyRequest => ({
    workspaceId,
    leadId: input.leadId,
})

/** Maps the independently owned records to the journey's GraphQL contract. */
export const toLeadJourneyType = (result: LeadJourneyData): LeadJourneyType => ({
    lead: toLeadRecordType(result.lead),
    responsibilities: result.responsibilities.map((step) => ({
        id: step.id,
        leadId: step.lead_id,
        title: step.title,
        ownerKind: step.owner_kind,
        ownerAgentId: step.owner_agent_id,
        ownerName: step.owner_name,
        nextAction: step.next_action,
        dueAt: step.due_at,
        status: step.status,
        createdAt: step.created_at,
    })),
    executions: result.executions.map((card) => ({
        id: card.id,
        workspaceId: card.workspace_id,
        responsibilityId: card.responsibility_id,
        agentId: card.agent_id,
        kind: card.kind,
        draft: card.draft,
        status: card.status,
        decidedBy: card.decided_by,
        decidedAt: card.decided_at,
        workItemId: card.work_item_id,
        createdAt: card.created_at,
    })),
    events: result.events.map((event) => ({
        id: event.id,
        leadId: event.lead_id,
        kind: event.kind,
        actor: event.actor,
        summary: event.summary,
        evidence: event.evidence,
        createdAt: event.created_at,
    })),
    agents: result.agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        handle: agent.handle,
        status: agent.status,
        module: agent.module,
    })),
})
