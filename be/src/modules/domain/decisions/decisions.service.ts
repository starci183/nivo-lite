import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AuthorityService } from "@modules/domain/authority"
import type { AuthorityPatch, AuthorityProfile } from "@modules/domain/authority"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import type { AuthorityRuleRecord, RuleChange } from "@modules/domain/authority-rules"
import { InvoicesService } from "@modules/domain/invoices"
import type { ReconcileInvoiceRow } from "@modules/domain/invoices"
import { StaffError, StaffErrorCode, StaffService } from "@modules/domain/staff"
import { TransactionsService } from "@modules/domain/transactions"
import { WorkspaceMembersService, canDecide } from "@modules/domain/workspace-members"
import { WorkItemsService, toProposal } from "@modules/domain/work-items"
import type { WorkspaceMember, WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { WorkContext, WorkItem } from "./decisions.contracts"
import type {
    AuthoritySheet,
    DecisionHistoryQuery,
    DecisionRecord,
    ListWorkItemsQuery,
    ReconcileCandidate,
    ReconcileDetails,
    ReconcilePayment,
    WorkItemPage,
} from "./decisions-views.contracts"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import { clampPageSize, splitPage } from "./paging.policy"
import { assigneeOf } from "./work-decision.policy"
import { LIST_DECISION_HISTORY } from "./persistence/decision-history.sql"
import type { AccountingWaitingWorkRow, WorkItemViewRow } from "./persistence/work-item-views.rows"
import { FIND_WORK_ITEM_VIEW, LIST_ACCOUNTING_WAITING_WORK, LIST_WORK_ITEMS } from "./persistence/work-item-views.sql"

/** A staff id, null when the assignment is cleared, or absent when the caller omitted it. */
type OptionalStaffId = string | null | undefined

const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

const HUMAN_DECIDERS = ["owner", "staff"]

/** The deciders a history kind narrows to; null for every decider. */
const decidersOf = (kind: DecisionHistoryQuery["kind"]): Array<string> | null => {
    if (kind === "policy") return ["policy"]
    return kind === "human" ? HUMAN_DECIDERS : null
}

const withoutCursor = (row: WorkItemViewRow): WorkItem => {
    const { cursor_at: _cursor, ...item } = row
    return item
}

/** A proposal field when it is text. */
const textField = (item: WorkItem, key: string): string | null => {
    const value = item.proposal.fields[key]
    return typeof value === "string" ? value : null
}

/** A note with its spaces collapsed. */
const collapsedNote = (note: string): string => note.trim().replace(/\s+/g, " ")

/** One reconcile invoice as the owner reads it. */
const candidateOf = (row: ReconcileInvoiceRow): ReconcileCandidate => ({ ...row })

@Injectable()
/** What the Decisions, Approvals and Authority pages read and change, for a caller who proves their membership. */
export class DecisionsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly authority: AuthorityService,
        private readonly rules: AuthorityRulesService,
        private readonly evidence: EvidenceService,
        private readonly workItems: WorkItemsService,
        private readonly staff: StaffService,
        private readonly invoices: InvoicesService,
        private readonly transactions: TransactionsService,
    ) {}

    /** Waiting accounting work and the related names; any workspace member may read. */
    async listAccountingWaiting(
        principalId: string,
        workspaceId: string,
        limit: number = 500,
    ): Promise<Array<AccountingWaitingWorkRow>> {
        await this.members.require(principalId, workspaceId)
        const rows = await this.entityManager.query<Array<AccountingWaitingWorkRow>>(LIST_ACCOUNTING_WAITING_WORK, [
            workspaceId,
            limit,
        ])
        return rows.map((row) => ({ ...row, proposal: toProposal(row.proposal) }))
    }

    /** One page of the workspace's work items, newest first; any member may read. */
    async listWorkItems(principalId: string, workspaceId: string, query: ListWorkItemsQuery): Promise<WorkItemPage> {
        await this.members.require(principalId, workspaceId)
        const size = clampPageSize(query.limit)
        const fetched = await this.entityManager.query<Array<WorkItemViewRow>>(LIST_WORK_ITEMS, [
            workspaceId,
            query.statuses,
            query.after?.createdAt ?? null,
            query.after?.id ?? null,
            size + 1,
            query.action ?? null,
        ])
        const page = splitPage(fetched, size)
        return { items: page.rows.map(withoutCursor), next: page.next }
    }

    /** One work item of the workspace; any member may read. */
    async getWorkItem(principalId: string, workspaceId: string, workItemId: string): Promise<WorkItem> {
        await this.members.require(principalId, workspaceId)
        const row = (
            await this.entityManager.query<Array<WorkItemViewRow>>(FIND_WORK_ITEM_VIEW, [workspaceId, workItemId])
        )[0]
        if (row === undefined) throw new DecisionsError({ code: DecisionsErrorCode.NotFound })
        return withoutCursor(row)
    }

    /** The newest lines of the decision log of the workspace, filtered; any member may read. */
    async listDecisionHistory(
        principalId: string,
        workspaceId: string,
        query: DecisionHistoryQuery,
    ): Promise<ReadonlyArray<DecisionRecord>> {
        await this.members.require(principalId, workspaceId)
        return this.entityManager.query<Array<DecisionRecord>>(LIST_DECISION_HISTORY, [
            workspaceId,
            decidersOf(query.kind),
            query.kind === "rejected" ? "rejected" : null,
            query.department,
            clampPageSize(query.limit),
        ])
    }

    /** The goals, house rules and every rule of the workspace; owner and manager only. */
    async readAuthority(principalId: string, workspaceId: string): Promise<AuthoritySheet> {
        await this.members.require(principalId, workspaceId, MANAGERS)
        return { profile: await this.authority.profileOf(workspaceId), rules: await this.rules.list(workspaceId) }
    }

    /** Saves the fields of the patch over the stored sheet; owner and manager only. */
    async updateAuthority(principalId: string, workspaceId: string, patch: AuthorityPatch): Promise<AuthorityProfile> {
        const member = await this.members.require(principalId, workspaceId, MANAGERS)
        const saved = await this.authority.save(workspaceId, patch, member.displayName)
        await this.log(workspaceId, member, "authority.updated", Object.keys(patch).join(", "))
        return saved
    }

    /** Saves the rule of one action; owner and manager only. */
    async saveRule(principalId: string, workspaceId: string, change: RuleChange): Promise<AuthorityRuleRecord> {
        const member = await this.members.require(principalId, workspaceId, MANAGERS)
        const saved = await this.rules.save(workspaceId, change)
        const limit = change.limit_vnd === null ? "" : ` < ${change.limit_vnd}`
        const summary = `${saved.department}.${saved.action} -> ${change.mode}${limit}`
        await this.log(workspaceId, member, "authority.rule_updated", summary)
        return saved
    }

    /** Gives an exception to a staff member, or takes it back when `staffId` is null. Owner and manager only. */
    async assignWorkItem(
        principalId: string,
        workspaceId: string,
        workItemId: string,
        staffId: OptionalStaffId,
    ): Promise<WorkItem> {
        const member = await this.members.require(principalId, workspaceId, MANAGERS)
        const staffName = await this.staffName(workspaceId, staffId)
        const assigned = await this.workItems.assign(workspaceId, workItemId, staffId)
        if (assigned === null) throw new DecisionsError({ code: DecisionsErrorCode.NotFound })
        await this.evidence.log(
            { workspaceId, actor: member.displayName, locale: "en" },
            {
                kind: "work.assigned",
                actor: member.displayName,
                summary: staffName === null ? "-> -" : `-> ${staffName}`,
                lead_id: assigned.lead_id,
                work_item_id: assigned.id,
            },
        )
        return this.getWorkItem(principalId, workspaceId, workItemId)
    }

    /** Keeps a waiting item waiting and records the caller's note. The caller must be allowed to decide it. */
    async holdWorkItem(
        principalId: string,
        workspaceId: string,
        workItemId: string,
        rawNote: string,
    ): Promise<WorkItem> {
        const member = await this.members.require(principalId, workspaceId)
        const current = await this.getWorkItem(principalId, workspaceId, workItemId)
        if (!canDecide(member, assigneeOf(current))) throw new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        const note = collapsedNote(rawNote)
        if (note.length === 0) throw new DecisionsError({ code: DecisionsErrorCode.HoldNoteRequired })
        if (current.status !== "waiting_decision") throw new DecisionsError({ code: DecisionsErrorCode.NotWaiting })
        const held = await this.workItems.hold(workspaceId, workItemId, note, member.displayName)
        if (held === null) throw new DecisionsError({ code: DecisionsErrorCode.NotWaiting })
        await this.evidence.log(
            { workspaceId, actor: member.displayName, locale: "en" },
            {
                kind: "work.held",
                actor: member.displayName,
                summary: note,
                evidence: note,
                lead_id: held.lead_id,
                work_item_id: held.id,
            },
        )
        return this.getWorkItem(principalId, workspaceId, workItemId)
    }

    /** The payment and the candidate invoices of a waiting reconciliation. Any member may read. */
    async reconcileDetails(principalId: string, workspaceId: string, workItemId: string): Promise<ReconcileDetails> {
        await this.members.require(principalId, workspaceId)
        const item = await this.getWorkItem(principalId, workspaceId, workItemId)
        const moment =
            item.subject_type === "transaction" && item.subject_id !== null
                ? await this.transactions.momentOf(workspaceId, item.subject_id)
                : null
        const ids = (item.proposal.candidates ?? []).map((candidate) => candidate.id)
        const rows = await this.invoices.listForReconcile(workspaceId, ids)
        const byId = new Map(rows.map((row) => [row.id, row]))
        const payment: ReconcilePayment = {
            amount_vnd: moment?.amount_vnd ?? item.proposal.amount_vnd ?? null,
            payer: moment?.payer ?? textField(item, "payer"),
            reference: moment?.reference ?? textField(item, "claim"),
            occurred_at: moment?.occurred_at ?? (item.subject_type === "invoice" ? item.created_at : null),
        }
        const candidates = ids.flatMap((id) => {
            const row = byId.get(id)
            return row === undefined ? [] : [candidateOf(row)]
        })
        return { payment, candidates }
    }

    private async staffName(workspaceId: string, staffId: OptionalStaffId): Promise<string | null> {
        if (staffId === null || staffId === undefined) return null
        const name = await this.staff.nameOf(workspaceId, staffId)
        if (name === null) throw new StaffError({ code: StaffErrorCode.NotFound })
        return name
    }

    private async log(workspaceId: string, member: WorkspaceMember, kind: string, summary: string): Promise<void> {
        const ctx: WorkContext = { workspaceId, actor: member.displayName, locale: "en" }
        await this.evidence.log(ctx, { kind, actor: member.displayName, summary })
    }
}
