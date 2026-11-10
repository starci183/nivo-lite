import { Injectable } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InboxLeadsError, InboxLeadsErrorCode } from "./errors/inbox-leads.error"
import { countsOf, inTab, matchesSearch, narrowed, searchOf, sortOf, sorted, tabOf } from "./inbox-lead-filter.policy"
import { approvalOf, needsOf, ordersOf, paidOf, sourceOf, timelineOf, viaOf } from "./inbox-lead-journey.policy"
import { rowOf } from "./inbox-lead-row.policy"
import type { AgentMark, LeadFacts } from "./inbox-lead-row.policy"
import { InboxLeadsEventsService } from "./inbox-leads-events.service"
import type { LeadEventGroup, StrayEventGroup, WorkFigures } from "./inbox-leads-events.service"
import { InboxLeadsRecordsService } from "./inbox-leads-records.service"
import type { LeadRecord, LeadRecords } from "./inbox-leads-records.service"
import type {
    InboxAgentOption,
    InboxFigures,
    InboxLeadDetail,
    InboxLeadRow,
    InboxLeadsPage,
    InboxLeadsQuery,
    OptionalAgentId,
} from "./inbox-leads.contracts"
import { isUuid } from "./record-fields.policy"

const MANAGERS = ["owner", "manager"] as const
const DAY_MS = 86_400_000
const AGENT_OPTIONS = 50

/** The rows of a read and the agents the workspace can hand a customer to. */
interface RowsRead {
    /** Every customer of the read, before the tab and the filters. */
    readonly rows: ReadonlyArray<InboxLeadRow>
    /** The active agents of the workspace. */
    readonly agents: ReadonlyArray<InboxAgentOption>
}

/** The facts of a lead that has records and inputs. */
const factsOfLead = (
    lead: LeadRecord,
    records: LeadRecords,
    group: LeadEventGroup | undefined,
    waiting: number,
): LeadFacts => ({
    id: lead.id,
    name: lead.name,
    channel: lead.channel,
    via: viaOf(lead.channel, group?.last_kind ?? ""),
    leadStage: lead.stage,
    need: lead.need,
    contextSummary: lead.contextSummary,
    quoteVnd: lead.quoteVnd,
    nextStep: lead.nextStep,
    ownerAgentId: lead.ownerAgentId,
    orders: records.orders.get(lead.id) ?? [],
    hasMatchedPayment: group?.has_payment ?? false,
    conversation: records.conversations.get(lead.id) ?? null,
    waitingWork: waiting,
    firstAt: group?.first_at ?? lead.createdAt,
    lastAt: group?.last_at ?? lead.updatedAt,
    eventCount: group?.event_count ?? 0,
    lastBody: group?.last_body ?? "",
    isUnmatched: false,
})

/** The facts of a customer that is no lead yet: a credit nobody claimed, or a sender nobody has matched. */
const factsOfStray = (stray: StrayEventGroup): LeadFacts => ({
    id: stray.id,
    name: stray.name,
    channel: stray.last_channel,
    via: viaOf(stray.last_channel, stray.last_kind),
    leadStage: null,
    need: null,
    contextSummary: null,
    quoteVnd: stray.amount_vnd,
    nextStep: null,
    ownerAgentId: null,
    orders: [],
    hasMatchedPayment: false,
    conversation: null,
    waitingWork: 0,
    firstAt: stray.first_at,
    lastAt: stray.last_at,
    eventCount: stray.event_count,
    lastBody: stray.last_body,
    isUnmatched: stray.last_kind === "payment",
})

/** The figures of the strip: customers by their first and latest input, what waits, and how the agents did this week. */
const figuresOf = (rows: ReadonlyArray<InboxLeadRow>, now: Date, week: WorkFigures): InboxFigures => ({
    visitors7d: rows.filter((row) => now.getTime() - new Date(row.lastAt).getTime() <= 7 * DAY_MS).length,
    newToday: rows.filter((row) => now.getTime() - new Date(row.firstAt).getTime() <= DAY_MS).length,
    needsYou: rows.filter((row) => row.needsOwner).length,
    autoReplyPct: week.total === 0 ? null : Math.round((week.auto / week.total) * 100),
    avgResponseSeconds: week.mean_seconds === null ? null : Math.round(week.mean_seconds),
})

@Injectable()
/**
 * The inbox as a list of customers. Every input of one person (a Zalo user, a phone, a web visitor) is grouped into one customer; its stage
 * comes from the facts (an order exists, a payment matched), not from a column. Reads go through the entity engine for the sales records and
 * through the inbox reads for the inputs, the work and the decisions; a read is for any member, a hand-over for an owner or a manager.
 */
export class InboxLeadsService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly records: InboxLeadsRecordsService,
        private readonly events: InboxLeadsEventsService,
        private readonly directory: AgentDirectoryService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** The customers of the workspace for a tab, with the counts of every tab, the figures and the agents. */
    async list(userId: string, workspaceId: string, query: InboxLeadsQuery): Promise<InboxLeadsPage> {
        await this.members.require(userId, workspaceId)
        const { rows, agents } = await this.rowsOf(workspaceId, searchOf(query.search))
        const now = this.clock.now()
        const week = await this.events.weekOf(workspaceId, new Date(now.getTime() - 7 * DAY_MS))
        const visible = narrowed(rows, query.channel, query.agentId)
        const tab = tabOf(query.tab)
        const inTheTab = visible.filter((row) => inTab(row, tab))
        return {
            leads: sorted(inTheTab, sortOf(query.sort)).slice(0, query.limit),
            counts: countsOf(visible),
            figures: figuresOf(rows, now, week),
            agents,
        }
    }

    /** One customer opened: the head, what waits for the owner, what they need, the journey and the aside. */
    async detail(userId: string, workspaceId: string, id: string): Promise<InboxLeadDetail> {
        await this.members.require(userId, workspaceId)
        return isUuid(id) ? this.detailOfLead(workspaceId, id) : this.detailOfStray(workspaceId, id)
    }

    /** Hands a customer to an agent of the workspace, or to nobody; owner or manager. */
    async assign(userId: string, workspaceId: string, leadId: string, agentId: OptionalAgentId): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGERS)
        if (agentId !== null && (await this.directory.find(workspaceId, agentId)) === null) {
            throw new InboxLeadsError({ code: InboxLeadsErrorCode.AgentUnknown })
        }
        await this.records.assign(workspaceId, leadId, agentId)
    }

    private async rowsOf(workspaceId: string, search: string | null): Promise<RowsRead> {
        const records = await this.records.read(workspaceId, search)
        const leadIds = records.leads.map((lead) => lead.id)
        const [groups, waiting, strays] = await Promise.all([
            this.events.groupsOf(workspaceId, leadIds),
            this.events.waitingOf(workspaceId, leadIds),
            this.events.straysOf(workspaceId),
        ])
        const byLead = new Map(groups.map((group) => [group.lead_id, group]))
        const facts = [
            ...records.leads.map((lead) => factsOfLead(lead, records, byLead.get(lead.id), waiting.get(lead.id) ?? 0)),
            ...strays.map(factsOfStray),
        ]
        const marks = await this.agentMarks(
            workspaceId,
            facts.flatMap((fact) => [fact.ownerAgentId, fact.conversation?.agentId ?? null]),
        )
        const rows = facts
            .map((fact) => rowOf(fact, marks))
            .filter((row) => isUuid(row.id) || matchesSearch(row, search))
        const options = (await this.directory.activeOf(workspaceId, AGENT_OPTIONS)).map((agent) => ({
            id: agent.id,
            name: agent.name,
        }))
        return { rows, agents: options }
    }

    private async agentMarks(
        workspaceId: string,
        ids: ReadonlyArray<OptionalAgentId>,
    ): Promise<ReadonlyMap<string, AgentMark>> {
        const wanted = [...new Set(ids.filter((id): id is string => id !== null))]
        const found = await this.directory.identitiesOf(workspaceId, wanted)
        return new Map(found.map((agent) => [agent.id, { name: agent.name, avatarUrl: agent.avatarUrl }]))
    }

    private async detailOfLead(workspaceId: string, id: string): Promise<InboxLeadDetail> {
        const records = await this.records.read(workspaceId, null, [id])
        const lead = records.leads.find((one) => one.id === id)
        if (lead === undefined) throw new InboxLeadsError({ code: InboxLeadsErrorCode.LeadNotFound })
        const [events, work, decisions, groups, waiting] = await Promise.all([
            this.events.journeyOf(workspaceId, { leadId: id }),
            this.events.workOf(workspaceId, id),
            this.events.decisionsOf(workspaceId, id),
            this.events.groupsOf(workspaceId, [id]),
            this.events.waitingOf(workspaceId, [id]),
        ])
        const group = groups.find((one) => one.lead_id === id)
        const facts = factsOfLead(lead, records, group, waiting.get(id) ?? 0)
        const marks = await this.agentMarks(workspaceId, [facts.ownerAgentId, facts.conversation?.agentId ?? null])
        const row = rowOf(facts, marks)
        const paid = paidOf(facts.orders)
        return {
            lead: row,
            phone: lead.phone,
            email: lead.email,
            zaloLinked: records.zaloLeadIds.has(id),
            approval: approvalOf(facts, row.agentName),
            needs: needsOf(facts, lead.note),
            timeline: timelineOf({ events, work, decisions, orders: facts.orders }),
            source: sourceOf(facts, events),
            orders: ordersOf(facts.orders),
            paidVnd: paid.amountVnd,
            paidCount: paid.count,
        }
    }

    private async detailOfStray(workspaceId: string, id: string): Promise<InboxLeadDetail> {
        const stray = (await this.events.straysOf(workspaceId)).find((one) => one.id === id)
        if (stray === undefined) throw new InboxLeadsError({ code: InboxLeadsErrorCode.LeadNotFound })
        const events = await this.events.journeyOf(workspaceId, { stray: id })
        const facts = factsOfStray(stray)
        return {
            lead: rowOf(facts, new Map()),
            phone: events.find((event) => event.sender_contact !== null)?.sender_contact ?? null,
            email: null,
            zaloLinked: false,
            approval: null,
            needs: needsOf(facts, null),
            timeline: timelineOf({ events, work: [], decisions: [], orders: [] }),
            source: sourceOf(facts, events),
            orders: [],
            paidVnd: 0,
            paidCount: 0,
        }
    }
}
