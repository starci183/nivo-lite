import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { DecisionsError, DecisionsErrorCode, DecisionsService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { ExecutionsService } from "@modules/domain/executions"
import { WorkspaceMembersService, canDecide } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { DecisionsJob, DecisionsQueue, decisionsDedupeKey } from "@modules/queues/decisions"
import type { SalesAction, SalesDecisionRequest, SalesDraftRequest } from "./sales.contracts"
import { SalesStatusService } from "./sales-status.service"

@Injectable()
/** Authorizes decisions in the request and enqueues the existing fenced decisions jobs. */
export class SalesDecisionsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly decisions: DecisionsService,
        private readonly executions: ExecutionsService,
        private readonly queue: DecisionsQueue,
        private readonly status: SalesStatusService,
    ) {}

    /** Queues a waiting work item's decision; its worker repeats all decision checks before performing. */
    async decideWorkItem(principalId: string, request: SalesDecisionRequest): Promise<SalesAction> {
        const item = await this.decisions.getWorkItem(principalId, request.workspaceId, request.id)
        await this.requireDecide(principalId, request.workspaceId, item)
        if (item.status !== "waiting_decision") throw new DecisionsError({ code: DecisionsErrorCode.NotWaiting })
        const attemptKey = `${item.id}:${item.updated_at}`
        return this.entityManager.transaction(async (tx) => {
            await this.queue.enqueueDecideWork(
                {
                    workspaceId: request.workspaceId,
                    userId: principalId,
                    locale: request.locale,
                    workItemId: item.id,
                    decision: request.decision,
                    edits: request.edits,
                    note: request.note,
                    basis: request.basis,
                },
                tx,
                attemptKey,
            )
            return this.status.queued(tx, request.workspaceId, decisionsDedupeKey(DecisionsJob.DecideWork, attemptKey))
        })
    }

    /** Queues the legacy approval card's decision through the same existing worker. */
    async decideDraft(principalId: string, request: SalesDraftRequest): Promise<SalesAction> {
        const member = await this.members.require(principalId, request.workspaceId)
        const card = await this.executions.find(request.workspaceId, request.id)
        if (card === null) throw new DecisionsError({ code: DecisionsErrorCode.NotFound })
        if (card.status !== "pending_approval") throw new DecisionsError({ code: DecisionsErrorCode.NotWaiting })
        let attemptKey = card.id
        if (card.work_item_id === null) {
            if (member.role === "staff") throw new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        } else {
            const item = await this.decisions.getWorkItem(principalId, request.workspaceId, card.work_item_id)
            await this.requireDecide(principalId, request.workspaceId, item)
            if (item.status !== "waiting_decision") throw new DecisionsError({ code: DecisionsErrorCode.NotWaiting })
            attemptKey = `${card.id}:${item.updated_at}`
        }
        return this.entityManager.transaction(async (tx) => {
            await this.queue.enqueueDecideExecution(
                {
                    workspaceId: request.workspaceId,
                    userId: principalId,
                    locale: request.locale,
                    executionId: card.id,
                    decision: request.decision,
                    editedDraft: request.editedDraft,
                },
                tx,
                attemptKey,
            )
            return this.status.queued(
                tx,
                request.workspaceId,
                decisionsDedupeKey(DecisionsJob.DecideExecution, attemptKey),
            )
        })
    }

    private async requireDecide(principalId: string, workspaceId: string, item: WorkItem): Promise<void> {
        const member = await this.members.require(principalId, workspaceId)
        if (
            !canDecide(member, {
                assigneeKind: item.assigned_staff_id === null ? null : "staff",
                assigneeId: item.assigned_staff_id,
            })
        )
            throw new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
    }
}
