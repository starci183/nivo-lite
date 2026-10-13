import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { DecisionsError, DecisionsErrorCode, DecisionsService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { WorkspaceMembersService, canDecide } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { DECISIONS_QUEUE, DecisionsJob, decisionsDedupeKey } from "@modules/queues/decisions"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import type { ApproveLeadGenCommentRequest, LeadGenCommentStatus } from "./leadgen-comment.contracts"
import type { LeadGenCommentJobRow } from "./persistence/leadgen-comment.rows"
import { FIND_LEADGEN_COMMENT_JOB } from "./persistence/leadgen-comment.sql"

@Injectable()
/** Authorizes a public-comment decision and enqueues the existing worker without performing provider work on the API request. */
export class LeadGenCommentService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly decisions: DecisionsService,
        @InjectQueueOutbox() private readonly queue: QueueOutbox,
    ) {}

    /** Approves one waiting public reply; the worker proves the caller's role again before resuming it. */
    async approve(userId: string, request: ApproveLeadGenCommentRequest): Promise<LeadGenCommentStatus> {
        const item = await this.commentOf(userId, request.workspaceId, request.workItemId)
        const member = await this.members.require(userId, request.workspaceId)
        if (
            !canDecide(member, {
                assigneeKind: item.assigned_staff_id === null ? null : "staff",
                assigneeId: item.assigned_staff_id,
            })
        )
            throw new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        if (item.status !== "waiting_decision") throw new DecisionsError({ code: DecisionsErrorCode.NotWaiting })
        await this.entityManager.transaction((tx) =>
            this.queue.write(
                tx,
                DECISIONS_QUEUE,
                {
                    workspaceId: request.workspaceId,
                    userId,
                    locale: request.locale,
                    workItemId: item.id,
                    decision: "approved",
                    edits: request.draft == null ? undefined : { draft: request.draft },
                },
                { job: DecisionsJob.DecideWork, dedupeKey: decisionsDedupeKey(DecisionsJob.DecideWork, item.id) },
            ),
        )
        return this.status(userId, request.workspaceId, item.id)
    }

    /** Reads workspace-scoped progress, including terminal worker failures even when the work item remains waiting. */
    async status(userId: string, workspaceId: string, workItemId: string): Promise<LeadGenCommentStatus> {
        const item = await this.commentOf(userId, workspaceId, workItemId)
        const [job] = await this.entityManager.query<Array<LeadGenCommentJobRow>>(FIND_LEADGEN_COMMENT_JOB, [
            workspaceId,
            DECISIONS_QUEUE,
            DecisionsJob.DecideWork,
            decisionsDedupeKey(DecisionsJob.DecideWork, workItemId),
        ])
        if (job === undefined && item.status !== "done" && item.status !== "failed" && item.status !== "rejected") {
            throw new DecisionsError({ code: DecisionsErrorCode.NotFound })
        }
        const failed =
            job?.state === "failed" ||
            item.status === "failed" ||
            item.status === "rejected" ||
            (job?.state === "done" && item.status !== "done")
        let status: string = job?.state ?? "failed"
        if (item.status === "done") status = "succeeded"
        if (failed) status = "failed"
        return {
            id: item.id,
            status,
            workStatus: item.status,
            resultHref: item.result?.href ?? null,
            errorCode: failed ? DecisionsErrorCode.WorkFailed : null,
        }
    }

    private async commentOf(userId: string, workspaceId: string, id: string): Promise<WorkItem> {
        const item = await this.decisions.getWorkItem(userId, workspaceId, id)
        if (item.department !== "lead_gen" || item.action !== "reply_comment_public") {
            throw new DecisionsError({ code: DecisionsErrorCode.NotFound })
        }
        return item
    }
}
