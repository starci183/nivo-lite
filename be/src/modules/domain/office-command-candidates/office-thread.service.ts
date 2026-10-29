import { Injectable } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ExecutionsService } from "@modules/domain/executions"
import type { ExecutionRecordRow } from "@modules/domain/executions"
import { LeadReadService } from "@modules/domain/leads"
import { isOfficeRoomKey, MessagesReadService } from "@modules/domain/messages"
import type { ThreadLine } from "@modules/domain/messages"
import { ResponsibilityReadService } from "@modules/domain/responsibilities"
import { WorkItemsService } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import {
    OfficeCommandCandidatesError,
    OfficeCommandCandidatesErrorCode,
} from "./errors/office-command-candidates.error"
import type { ApprovalView, MessagePage, MessagePageQuery, MessageView } from "./office-command-candidates.contracts"
import { toApprovalView } from "./office-thread.mapper"
import type { ApprovalLine } from "./office-reads.contracts"
import { cardRefOf, executionStateOf, isRecordId, workItemStateOf } from "./thread-card.policy"
import type { CardRef, CardState } from "./thread-card.policy"
import { clampPageSize, isValidCursor, splitPage } from "./thread-page.policy"

/** The most waiting executions one call returns. */
const PENDING_LIMIT = 100
/** The decided executions the Office keeps in view. */
const DECIDED_LIMIT = 8

/** The status an approval line carries: the queries only select the three the contract names. */
const approvalStatusOf = (status: string): ApprovalLine["status"] =>
    status === "pending_approval" || status === "approved" ? status : "rejected"

/** The ids of the records the cards of a page point at, by kind, in the form a lookup accepts. */
const idsOfKind = (refs: ReadonlyArray<CardRef | null>, kind: string): Array<string> => [
    ...new Set(refs.flatMap((ref) => (ref !== null && ref.kind === kind && isRecordId(ref.id) ? [ref.id] : []))),
]

/** The distinct ids among the given ones, none of them missing. */
const distinct = (ids: ReadonlyArray<string | null>): Array<string> => [
    ...new Set(ids.flatMap((id) => (id === null ? [] : [id]))),
]

@Injectable()
/** The Office thread as the screen reads it: the lines, keyset paged, and the approval panels. Every call proves membership first. */
export class OfficeThreadService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly lines: MessagesReadService,
        private readonly leads: LeadReadService,
        private readonly workItems: WorkItemsService,
        private readonly executions: ExecutionsService,
        private readonly steps: ResponsibilityReadService,
        private readonly agents: AgentDirectoryService,
    ) {}

    /** One page of the thread, newest first; the cursor of the next, older page rides in the answer. */
    async messages(principalId: string, workspaceId: string, query: MessagePageQuery): Promise<MessagePage> {
        await this.members.require(principalId, workspaceId)
        const before = query.before
        if ((before !== null && !isValidCursor(before)) || (query.room !== null && !isOfficeRoomKey(query.room)))
            throw new OfficeCommandCandidatesError({ code: OfficeCommandCandidatesErrorCode.PageInvalid })
        const size = clampPageSize(query.limit)
        const lines = await this.lines.page(workspaceId, { room: query.room, before, size })
        return splitPage(await this.viewsOf(workspaceId, lines), size)
    }

    /** The executions waiting for a human decision, newest first. */
    async pendingApprovals(principalId: string, workspaceId: string): Promise<ReadonlyArray<ApprovalView>> {
        await this.members.require(principalId, workspaceId)
        return this.approvalsOf(workspaceId, await this.executions.pendingApprovals(workspaceId, PENDING_LIMIT))
    }

    /** The most recently approved or rejected executions, newest decision first. */
    async decidedApprovals(principalId: string, workspaceId: string): Promise<ReadonlyArray<ApprovalView>> {
        await this.members.require(principalId, workspaceId)
        return this.approvalsOf(workspaceId, await this.executions.decidedApprovals(workspaceId, DECIDED_LIMIT))
    }

    /** The lines with the customer's name, the department of the work item and the live state of the card each carries. */
    private async viewsOf(workspaceId: string, lines: ReadonlyArray<ThreadLine>): Promise<Array<MessageView>> {
        const refs = lines.map((line) => cardRefOf(line.card_json))
        const workItemIds = distinct([...lines.map((line) => line.work_item_id), ...idsOfKind(refs, "work_item")])
        const [customers, items, executions] = await Promise.all([
            this.leads.cardsOf(workspaceId, distinct(lines.map((line) => line.lead_id))),
            this.workItems.findMany(workItemIds, workItemIds.length),
            this.executions.statusesOf(workspaceId, idsOfKind(refs, "execution")),
        ])
        const customerName = new Map(customers.map((customer) => [customer.id, customer.contactName]))
        const own = items.filter((item) => item.workspace_id === workspaceId)
        const department = new Map(own.map((item) => [item.id, item.department]))
        const itemState = new Map(own.map((item) => [item.id, workItemStateOf(item.status)]))
        const executionState = new Map(executions.map((card) => [card.id, executionStateOf(card.status)]))
        const stateOf = (ref: CardRef | null): CardState | null => {
            if (ref === null) return "info"
            if (ref.kind === "execution") return executionState.get(ref.id) ?? "info"
            return ref.kind === "work_item" ? (itemState.get(ref.id) ?? "info") : "info"
        }
        return lines.map((line, index): MessageView => ({
            ...line,
            lead_name: customerName.get(line.lead_id ?? "") ?? null,
            department: department.get(line.work_item_id ?? "") ?? null,
            card_state: line.card_json === null ? null : stateOf(refs[index] ?? null),
        }))
    }

    /** The executions with the context an approval card shows: the step, the customer, the agent and the work item. */
    private async approvalsOf(
        workspaceId: string,
        records: ReadonlyArray<ExecutionRecordRow>,
    ): Promise<Array<ApprovalView>> {
        const steps = await this.steps.stepsOf(
            workspaceId,
            records.map((record) => record.responsibility_id),
        )
        const workItemIds = distinct(records.map((record) => record.work_item_id))
        const [customers, agents, items] = await Promise.all([
            this.leads.cardsOf(workspaceId, distinct(steps.map((step) => step.leadId))),
            this.agents.cardsOf(workspaceId, distinct(records.map((record) => record.agent_id))),
            this.workItems.findMany(workItemIds, workItemIds.length),
        ])
        const stepOf = new Map(steps.map((step) => [step.id, step]))
        const customerOf = new Map(customers.map((customer) => [customer.id, customer]))
        const agentName = new Map(agents.map((agent) => [agent.id, agent.name]))
        const staffOf = new Map(items.map((item) => [item.id, item.assigned_staff_id]))
        return records.map((record) => {
            const step = stepOf.get(record.responsibility_id)
            const customer = customerOf.get(step?.leadId ?? "")
            return toApprovalView({
                id: record.id,
                responsibility_id: record.responsibility_id,
                agent_id: record.agent_id,
                kind: record.kind,
                draft: record.draft,
                status: approvalStatusOf(record.status),
                decided_by: record.decided_by,
                work_item_id: record.work_item_id,
                decided_at: record.decided_at,
                created_at: record.created_at,
                lead_id: step?.leadId ?? null,
                next_action: step?.nextAction ?? null,
                owner_name: step?.ownerName ?? null,
                contact_name: customer?.contactName ?? null,
                company: customer?.company ?? null,
                channel: customer?.channel ?? null,
                agent_name: agentName.get(record.agent_id ?? "") ?? null,
                assigned_staff_id: staffOf.get(record.work_item_id ?? "") ?? null,
            })
        })
    }
}
