import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AuthorityService } from "@modules/domain/authority"
import type { AuthorityPatch, AuthorityProfile } from "@modules/domain/authority"
import { AuthorityActionsService, ruleRefusalOf } from "@modules/domain/authority-actions"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import type { AuthorityRuleRecord, RuleChange } from "@modules/domain/authority-rules"
import { InvoicesService } from "@modules/domain/invoices"
import type { ReconcileInvoiceRow } from "@modules/domain/invoices"
import { TransactionsService } from "@modules/domain/transactions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { toProposal } from "@modules/domain/work-items"
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
import { LIST_DECISION_HISTORY } from "./persistence/decision-history.sql"
import type { AccountingWaitingWorkRow, WorkItemViewRow } from "./persistence/work-item-views.rows"
import { ruleSummary } from "./rule-save.policy"
import { FIND_WORK_ITEM_VIEW, LIST_ACCOUNTING_WAITING_WORK, LIST_WORK_ITEMS } from "./persistence/work-item-views.sql"

/** A proposal field when it is text. */
const textField = (item: WorkItem, key: string): string | null => {
    const value = item.proposal.fields[key]
    return typeof value === "string" ? value : null
}

/** One reconcile invoice as the owner reads it. */
const candidateOf = (row: ReconcileInvoiceRow): ReconcileCandidate => ({ ...row })

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

@Injectable()
/** What the Decisions, Approvals and Authority pages read and change, for a caller who proves their membership. */
export class DecisionsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly authority: AuthorityService,
        private readonly rules: AuthorityRulesService,
        private readonly actions: AuthorityActionsService,
        private readonly evidence: EvidenceService,
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

    /**
     * Saves the rule of one action; owner and manager only. The catalogue has the last word: an action outside the registry or under
     * another department is refused, and so is "auto" for an action that can never run by itself, whichever door the change came through.
     */
    async saveRule(principalId: string, workspaceId: string, change: RuleChange): Promise<AuthorityRuleRecord> {
        const member = await this.members.require(principalId, workspaceId, MANAGERS)
        const record = (await this.actions.list(this.entityManager)).find((entry) => entry.action === change.action)
        const refusal = ruleRefusalOf(record, change)
        if (refusal !== null) {
            const code = refusal === "unknown_action" ? DecisionsErrorCode.UnknownAction : DecisionsErrorCode.ModeCapped
            throw new DecisionsError({ code, params: { action: change.action } })
        }
        const saved = await this.rules.save(workspaceId, change)
        await this.log(workspaceId, member, "authority.rule_updated", ruleSummary(saved, change))
        return saved
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

    private async log(workspaceId: string, member: WorkspaceMember, kind: string, summary: string): Promise<void> {
        const ctx: WorkContext = { workspaceId, actor: member.displayName, locale: "en" }
        await this.evidence.log(ctx, { kind, actor: member.displayName, summary })
    }
}
