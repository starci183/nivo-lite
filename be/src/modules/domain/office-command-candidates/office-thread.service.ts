import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import {
    OfficeCommandCandidatesError,
    OfficeCommandCandidatesErrorCode,
} from "./errors/office-command-candidates.error"
import type { ApprovalView, MessagePage, MessagePageQuery, MessageView } from "./office-command-candidates.contracts"
import { toApprovalView } from "./office-thread.mapper"
import type { ApprovalRow } from "./persistence/office-thread.rows"
import { LIST_DECIDED_APPROVALS, LIST_MESSAGES, LIST_PENDING_APPROVALS } from "./persistence/office-thread.sql"
import { clampPageSize, isValidCursor, splitPage } from "./thread-page.policy"

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
        if (before !== null && !isValidCursor(before))
            throw new OfficeCommandCandidatesError({ code: OfficeCommandCandidatesErrorCode.PageInvalid })
        const size = clampPageSize(query.limit)
        const rows = await this.entityManager.query<Array<MessageView>>(LIST_MESSAGES, [
            workspaceId,
            before?.createdAt ?? null,
            before?.id ?? null,
            size + 1,
        ])
        return splitPage(rows, size)
    }

    /** The executions waiting for a human decision, newest first. */
    async pendingApprovals(principalId: string, workspaceId: string): Promise<ReadonlyArray<ApprovalView>> {
        await this.members.require(principalId, workspaceId)
        const rows = await this.entityManager.query<Array<ApprovalRow>>(LIST_PENDING_APPROVALS, [
            workspaceId,
            PENDING_LIMIT,
        ])
        return rows.map(toApprovalView)
    }

    /** The most recently approved or rejected executions, newest decision first. */
    async decidedApprovals(principalId: string, workspaceId: string): Promise<ReadonlyArray<ApprovalView>> {
        await this.members.require(principalId, workspaceId)
        const rows = await this.entityManager.query<Array<ApprovalRow>>(LIST_DECIDED_APPROVALS, [
            workspaceId,
            DECIDED_LIMIT,
        ])
        return rows.map(toApprovalView)
    }
}
