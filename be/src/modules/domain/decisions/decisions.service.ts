import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember, WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { mergeAuthority } from "./authority.policy"
import type {
    AuthorityPatch,
    AuthorityProfile,
    AuthorityRuleRecord,
    AuthoritySheet,
    ListWorkItemsQuery,
    RuleChange,
    WorkContext,
    WorkItem,
    WorkItemPage,
} from "./decisions.contracts"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import { clampPageSize, splitPage } from "./paging.policy"
import type { AuthorityProfileRow, RuleRecordRow } from "./persistence/authority.rows"
import { FIND_AUTHORITY_PROFILE, LIST_RULES, UPSERT_AUTHORITY, UPSERT_RULE } from "./persistence/authority.sql"
import type { WorkItemViewRow } from "./persistence/work-item-views.rows"
import { FIND_WORK_ITEM_VIEW, LIST_WORK_ITEMS } from "./persistence/work-item-views.sql"

const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

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
        private readonly evidence: EvidenceService,
    ) {}

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

    /** The goals, house rules and every rule of the workspace; owner and manager only. */
    async readAuthority(principalId: string, workspaceId: string): Promise<AuthoritySheet> {
        await this.members.require(principalId, workspaceId, MANAGERS)
        const profile = await this.entityManager.query<Array<AuthorityProfileRow>>(FIND_AUTHORITY_PROFILE, [
            workspaceId,
        ])
        const rules = await this.entityManager.query<Array<RuleRecordRow>>(LIST_RULES, [workspaceId])
        return { profile: profile[0] ?? null, rules }
    }

    /** Saves the fields of the patch over the stored sheet; owner and manager only. */
    async updateAuthority(principalId: string, workspaceId: string, patch: AuthorityPatch): Promise<AuthorityProfile> {
        const member = await this.members.require(principalId, workspaceId, MANAGERS)
        const current = (
            await this.entityManager.query<Array<AuthorityProfileRow>>(FIND_AUTHORITY_PROFILE, [workspaceId])
        )[0]
        const next = mergeAuthority(current ?? null, patch)
        const saved = (
            await this.entityManager.query<Array<AuthorityProfileRow>>(UPSERT_AUTHORITY, [
                workspaceId,
                next.policies,
                next.reply_style,
                next.brand_voice,
                next.limits_note,
                next.goal_revenue_vnd,
                next.goal_new_customers,
                next.goal_first_reply_minutes,
                next.goal_note,
                member.displayName,
            ])
        )[0]
        if (saved === undefined) throw new DecisionsError({ code: DecisionsErrorCode.NotFound })
        await this.log(workspaceId, member, "authority.updated", Object.keys(patch).join(", "))
        return saved
    }

    /** Saves the rule of one action; owner and manager only. */
    async saveRule(principalId: string, workspaceId: string, change: RuleChange): Promise<AuthorityRuleRecord> {
        const member = await this.members.require(principalId, workspaceId, MANAGERS)
        const saved = (
            await this.entityManager.query<Array<RuleRecordRow>>(UPSERT_RULE, [
                workspaceId,
                change.action,
                change.mode,
                change.limit_vnd,
                change.required_fields,
            ])
        )[0]
        if (saved === undefined) {
            throw new DecisionsError({ code: DecisionsErrorCode.UnknownAction, params: { action: change.action } })
        }
        const limit = change.limit_vnd === null ? "" : ` < ${change.limit_vnd}`
        const summary = `${saved.department}.${saved.action} -> ${change.mode}${limit}`
        await this.log(workspaceId, member, "authority.rule_updated", summary)
        return saved
    }

    private async log(workspaceId: string, member: WorkspaceMember, kind: string, summary: string): Promise<void> {
        const ctx: WorkContext = { workspaceId, actor: member.displayName, locale: "en" }
        await this.evidence.log(ctx, { kind, actor: member.displayName, summary })
    }
}
