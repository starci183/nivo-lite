import { Injectable } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { EventsService } from "@modules/domain/events"
import { ExecutionsFiguresService } from "@modules/domain/executions"
import { LeadReadService } from "@modules/domain/leads"
import type { LeadCard } from "@modules/domain/leads"
import { ResponsibilityReadService } from "@modules/domain/responsibilities"
import { StaffDirectoryService } from "@modules/domain/staff"
import { WorkItemsReadService } from "@modules/domain/work-items"
import type {
    OverviewAgent,
    OverviewEvent,
    OverviewException,
    OverviewExceptionLead,
    OverviewLead,
    OverviewPending,
    OverviewResponsibility,
} from "./overview.contracts"

/** How many responsibilities the dashboard reads. */
const RESPONSIBILITY_LIMIT = 2000
/** How many agents the dashboard reads. */
const AGENT_LIMIT = 200
/** How many leads the figures count. */
const LEAD_LIMIT = 10_000
/** How many drafts waiting for a decision the dashboard reads. */
const PENDING_LIMIT = 2000
/** How many exceptions the dashboard lists. */
const EXCEPTION_LIMIT = 100

/** The text of an instant: ISO 8601 in UTC with milliseconds. */
export const instant = (at: Date): string => at.toISOString()

/** The lead of an exception, or null when the lead is gone. */
const exceptionLeadOf = (card: LeadCard | undefined): OverviewExceptionLead | null =>
    card === undefined
        ? null
        : { id: card.id, contactName: card.contactName, company: card.company, channel: card.channel }

/** The rows keyed by their id. */
const indexById = <Row extends { readonly id: string }>(rows: ReadonlyArray<Row>): Map<string, Row> =>
    new Map(rows.map((row) => [row.id, row]))

/** The ids that are set. */
const presentIds = (ids: ReadonlyArray<string | null>): Array<string> => ids.filter((id): id is string => id !== null)

@Injectable()
/** The list reads of the executive dashboard, each bounded as the former statement was and answered by the capability that owns the rows. */
export class OverviewReadsService {
    constructor(
        private readonly responsibilityReads: ResponsibilityReadService,
        private readonly agentDirectory: AgentDirectoryService,
        private readonly eventsLog: EventsService,
        private readonly leadReads: LeadReadService,
        private readonly executionFigures: ExecutionsFiguresService,
        private readonly workReads: WorkItemsReadService,
        private readonly staff: StaffDirectoryService,
    ) {}

    /** Every responsibility with its lead, due soonest first. */
    async responsibilities(workspaceId: string): Promise<Array<OverviewResponsibility>> {
        const steps = await this.responsibilityReads.dueSoonest(workspaceId, RESPONSIBILITY_LIMIT)
        const leads = indexById(
            await this.leadReads.cardsOf(workspaceId, [...new Set(steps.map((step) => step.leadId))]),
        )
        return steps.flatMap((step): Array<OverviewResponsibility> => {
            const lead = leads.get(step.leadId)
            if (lead === undefined) return []
            return [
                {
                    id: step.id,
                    leadId: step.leadId,
                    title: step.title,
                    ownerKind: step.ownerKind,
                    ownerAgentId: step.ownerAgentId,
                    ownerName: step.ownerName,
                    nextAction: step.nextAction,
                    dueAt: step.dueAt === null ? null : instant(step.dueAt),
                    status: step.status,
                    createdAt: instant(step.createdAt),
                    lead: { id: lead.id, contactName: lead.contactName, company: lead.company, stage: lead.stage },
                },
            ]
        })
    }

    /** The agents, oldest first. */
    async agents(workspaceId: string): Promise<Array<OverviewAgent>> {
        const agents = await this.agentDirectory.sheetsOf(workspaceId, AGENT_LIMIT)
        return agents.map((agent) => ({ ...agent, createdAt: instant(agent.createdAt) }))
    }

    /** The newest evidence lines, newest first. */
    async events(workspaceId: string, count: number): Promise<Array<OverviewEvent>> {
        const lines = await this.eventsLog.list(workspaceId, { limit: count })
        return lines.map((line) => ({
            id: line.id,
            leadId: line.lead_id,
            kind: line.kind,
            actor: line.actor,
            summary: line.summary,
            evidence: line.evidence,
            createdAt: line.created_at,
        }))
    }

    /** The leads the overview figures count. */
    async leads(workspaceId: string): Promise<Array<OverviewLead>> {
        const leads = await this.leadReads.summariesOf(workspaceId, LEAD_LIMIT)
        return leads.map((lead) => ({ ...lead, createdAt: instant(lead.createdAt) }))
    }

    /** The drafts waiting for a decision with the lead behind each, newest first. */
    async pending(workspaceId: string): Promise<Array<OverviewPending>> {
        const drafts = await this.executionFigures.pendingOf(workspaceId, PENDING_LIMIT)
        const steps = await this.responsibilityReads.leadsOf(
            workspaceId,
            drafts.map((draft) => draft.responsibilityId),
        )
        const leadOf = new Map(steps.map((step) => [step.id, step.leadId]))
        return drafts.map((draft) => ({
            id: draft.id,
            responsibilityId: draft.responsibilityId,
            createdAt: instant(draft.createdAt),
            leadId: leadOf.get(draft.responsibilityId) ?? null,
        }))
    }

    /** The work items waiting for a decision or failed, with their lead and assigned staff, oldest first. */
    async exceptions(workspaceId: string): Promise<Array<OverviewException>> {
        const items = await this.workReads.exceptions(workspaceId, EXCEPTION_LIMIT)
        const [cards, people] = await Promise.all([
            this.leadReads.cardsOf(workspaceId, presentIds(items.map((item) => item.leadId))),
            this.staff.namesOf(workspaceId, presentIds(items.map((item) => item.assignedStaffId))),
        ])
        const leadOf = indexById(cards)
        const staffName = indexById(people)
        return items.map((item): OverviewException => ({
            id: item.id,
            leadId: item.leadId,
            department: item.department,
            action: item.action,
            status: item.status,
            reason: item.reason,
            error: item.error,
            executionId: item.executionId,
            assignedStaffName:
                item.assignedStaffId === null ? null : (staffName.get(item.assignedStaffId)?.name ?? null),
            createdAt: instant(item.createdAt),
            summary: item.summary,
            contact: item.contact,
            customer: item.customer,
            lead: exceptionLeadOf(item.leadId === null ? undefined : leadOf.get(item.leadId)),
        }))
    }
}
