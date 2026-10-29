import { Injectable } from "@nestjs/common"
import type { EntityManager, ObjectLiteral, SelectQueryBuilder } from "typeorm"
import { isOfficeRoomKey } from "@modules/domain/messages"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import {
    OfficeCommandCandidatesError,
    OfficeCommandCandidatesErrorCode,
} from "./errors/office-command-candidates.error"
import type { ApprovalView, MessagePage, MessagePageQuery, MessageView } from "./office-command-candidates.contracts"
import { toApprovalView } from "./office-thread.mapper"
import type { ApprovalLine } from "./office-reads.contracts"
import { clampPageSize, isValidCursor, splitPage } from "./thread-page.policy"

/** The card state, read live from the execution or the work item the card names. */
const CARD_STATE = `CASE
    WHEN m.card IS NULL THEN NULL
    WHEN m.card #>> '{ref,kind}' = 'execution' THEN COALESCE((
        SELECT CASE x.status WHEN 'pending_approval' THEN 'pending' WHEN 'approved' THEN 'approved' ELSE 'declined' END
        FROM public.executions x
        WHERE x.id::text = m.card #>> '{ref,id}' AND x.workspace_id = m.workspace_id), 'info')
    WHEN m.card #>> '{ref,kind}' = 'work_item' THEN COALESCE((
        SELECT CASE r.status WHEN 'waiting_decision' THEN 'pending' WHEN 'done' THEN 'done'
                             WHEN 'rejected' THEN 'declined' WHEN 'failed' THEN 'failed' ELSE 'queued' END
        FROM public.work_items r
        WHERE r.id::text = m.card #>> '{ref,id}' AND r.workspace_id = m.workspace_id), 'info')
    ELSE 'info'
END`

/** The most waiting executions one call returns. */
const PENDING_LIMIT = 100
/** The decided executions the Office keeps in view. */
const DECIDED_LIMIT = 8

@Injectable()
/** The Office thread as the screen reads it: the lines, keyset paged, and the approval panels. Every call proves membership first. */
export class OfficeThreadService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** One page of the thread, newest first; the cursor of the next, older page rides in the answer. */
    async messages(principalId: string, workspaceId: string, query: MessagePageQuery): Promise<MessagePage> {
        await this.members.require(principalId, workspaceId)
        const before = query.before
        if ((before !== null && !isValidCursor(before)) || (query.room !== null && !isOfficeRoomKey(query.room)))
            throw new OfficeCommandCandidatesError({ code: OfficeCommandCandidatesErrorCode.PageInvalid })
        const size = clampPageSize(query.limit)
        const page = this.entityManager
            .createQueryBuilder()
            .select("m.id", "id")
            .addSelect("m.author_kind", "author_kind")
            .addSelect("m.author_name", "author_name")
            .addSelect("m.author_user_id::text", "author_user_id")
            .addSelect("m.agent_id", "agent_id")
            .addSelect("m.staff_id", "staff_id")
            .addSelect("m.body", "body")
            .addSelect("m.lead_id", "lead_id")
            .addSelect("m.work_item_id", "work_item_id")
            .addSelect("l.contact_name", "lead_name")
            .addSelect("w.department", "department")
            .addSelect("m.room", "room")
            .addSelect("m.card::text", "card_json")
            .addSelect(CARD_STATE, "card_state")
            .addSelect("to_json(m.created_at) #>> '{}'", "created_at")
            .from("public.messages", "m")
            .leftJoin("leads", "l", "l.id = m.lead_id AND l.workspace_id = m.workspace_id")
            .leftJoin("work_items", "w", "w.id = m.work_item_id AND w.workspace_id = m.workspace_id")
            .where("m.workspace_id = :workspaceId", { workspaceId })
        if (query.room !== null) page.andWhere("m.room = :room", { room: query.room })
        if (before !== null)
            page.andWhere("(m.created_at, m.id) < (CAST(:beforeAt AS timestamptz), CAST(:beforeId AS uuid))", {
                beforeAt: before.createdAt,
                beforeId: before.id,
            })
        const rows = await page
            .orderBy("m.created_at", "DESC")
            .addOrderBy("m.id", "DESC")
            .limit(size + 1)
            .getRawMany<MessageView>()
        return splitPage(rows, size)
    }

    /** The executions waiting for a human decision, newest first. */
    async pendingApprovals(principalId: string, workspaceId: string): Promise<ReadonlyArray<ApprovalView>> {
        await this.members.require(principalId, workspaceId)
        const rows = await this.approvalsOf(workspaceId)
            .andWhere("x.status = 'pending_approval'")
            .orderBy("x.created_at", "DESC")
            .addOrderBy("x.id", "DESC")
            .limit(PENDING_LIMIT)
            .getRawMany<ApprovalLine>()
        return rows.map(toApprovalView)
    }

    /** The most recently approved or rejected executions, newest decision first. */
    async decidedApprovals(principalId: string, workspaceId: string): Promise<ReadonlyArray<ApprovalView>> {
        await this.members.require(principalId, workspaceId)
        const rows = await this.approvalsOf(workspaceId)
            .andWhere("x.status IN ('approved', 'rejected')")
            .orderBy("x.decided_at", "DESC", "NULLS LAST")
            .addOrderBy("x.id", "DESC")
            .limit(DECIDED_LIMIT)
            .getRawMany<ApprovalLine>()
        return rows.map(toApprovalView)
    }

    /** The executions of the workspace with the context an approval card shows. */
    private approvalsOf(workspaceId: string): SelectQueryBuilder<ObjectLiteral> {
        return this.entityManager
            .createQueryBuilder()
            .select([
                "x.id AS id",
                "x.responsibility_id AS responsibility_id",
                "x.agent_id AS agent_id",
                "x.kind AS kind",
                "x.draft AS draft",
                "x.status AS status",
                "x.decided_by AS decided_by",
                "x.work_item_id AS work_item_id",
                "to_json(x.decided_at) #>> '{}' AS decided_at",
                "to_json(x.created_at) #>> '{}' AS created_at",
                "r.lead_id AS lead_id",
                "r.next_action AS next_action",
                "r.owner_name AS owner_name",
                "l.contact_name AS contact_name",
                "l.company AS company",
                "l.channel AS channel",
                "a.name AS agent_name",
                "w.assigned_staff_id AS assigned_staff_id",
            ])
            .from("public.executions", "x")
            .leftJoin("responsibilities", "r", "r.id = x.responsibility_id")
            .leftJoin("leads", "l", "l.id = r.lead_id")
            .leftJoin("agents", "a", "a.id = x.agent_id")
            .leftJoin("work_items", "w", "w.id = x.work_item_id")
            .where("x.workspace_id = :workspaceId", { workspaceId })
    }
}
