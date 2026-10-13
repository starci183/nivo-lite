import { Injectable } from "@nestjs/common"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { EntityManager } from "typeorm"
import {
    DecisionsError,
    DecisionsErrorCode,
    DecisionsService,
    EvidenceService,
    WorkEngineService,
} from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { InvoicesService } from "@modules/domain/invoices"
import { OrdersService, OrdersError, OrdersErrorCode } from "@modules/domain/orders"
import { WorkItemsService } from "@modules/domain/work-items"
import { WorkspaceMembersService, canDecide } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { DecisionsJob, DecisionsQueue, decisionsDedupeKey } from "@modules/queues/decisions"
import type { SalesAction, SalesItemRequest } from "./sales.contracts"
import { SalesStatusService } from "./sales-status.service"

@Injectable()
/** Retry, stop and handoff operations over the existing work engine and its row owners. */
export class SalesWorkService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly decisions: DecisionsService,
        private readonly items: WorkItemsService,
        private readonly orders: OrdersService,
        private readonly invoices: InvoicesService,
        private readonly engine: WorkEngineService,
        private readonly evidence: EvidenceService,
        private readonly queue: DecisionsQueue,
        private readonly status: SalesStatusService,
    ) {}

    /** Reopens a failed step and atomically queues its gated work with the retry evidence. */
    async retry(principalId: string, request: SalesItemRequest): Promise<SalesAction> {
        const item = await this.decisions.getWorkItem(principalId, request.workspaceId, request.id)
        const member = await this.requireDecide(principalId, request.workspaceId, item)
        if (item.status !== "failed") throw new DecisionsError({ code: DecisionsErrorCode.NotFailed })
        return this.entityManager.transaction(async (tx) => {
            const changed = await this.items.retry(request.workspaceId, item.id, ["failed"], tx)
            if (changed === null) throw new DecisionsError({ code: DecisionsErrorCode.StateChanged })
            const result = await this.enqueue(principalId, request, item, tx, "retry")
            await this.log(
                request,
                member,
                item,
                "work.retried",
                this.catalog.get("sales.retried", { who: member.displayName }, request.locale),
                tx,
            )
            return result
        })
    }

    /** Stops a failed item and records both audits in the same guarded transaction. */
    async stop(principalId: string, request: SalesItemRequest): Promise<WorkItem> {
        const item = await this.decisions.getWorkItem(principalId, request.workspaceId, request.id)
        const member = await this.requireDecide(principalId, request.workspaceId, item)
        if (item.status !== "failed") throw new DecisionsError({ code: DecisionsErrorCode.NotFailed })
        return this.entityManager.transaction(async (tx) => {
            const changed = await this.items.stopFailed(request.workspaceId, item.id, tx)
            if (changed === null) throw new DecisionsError({ code: DecisionsErrorCode.StateChanged })
            const ctx = { workspaceId: request.workspaceId, actor: member.displayName, locale: request.locale }
            await this.evidence.decide(
                ctx,
                {
                    work_item_id: item.id,
                    lead_id: item.lead_id,
                    department: item.department,
                    action: item.action,
                    decided_by: member.displayName,
                    decider_kind: member.role === "staff" ? "staff" : "owner",
                    outcome: "rejected",
                    reason: item.reason,
                    note: this.catalog.get("sales.stopNote", {}, request.locale),
                },
                tx,
            )
            await this.log(
                request,
                member,
                item,
                "work.stopped",
                this.catalog.get("sales.stopped", { who: member.displayName }, request.locale),
                tx,
            )
            return changed
        })
    }

    /** Queues Accounting's existing deduped invoice step for a confirmed order without an active invoice. */
    async handoff(principalId: string, request: SalesItemRequest): Promise<SalesAction> {
        const member = await this.members.require(principalId, request.workspaceId)
        const order = await this.orders.find(request.workspaceId, request.id)
        if (order === null) throw new DecisionsError({ code: DecisionsErrorCode.NotFound })
        if (order.status !== "confirmed") throw new OrdersError({ code: OrdersErrorCode.NotConfirmed })
        const invoice = await this.invoices.ofOrder(request.workspaceId, order.id)
        if (invoice !== null) throw new OrdersError({ code: OrdersErrorCode.AlreadyInvoiced })
        const item = await this.engine.runWork(
            {
                workspaceId: request.workspaceId,
                actor: member.displayName,
                locale: request.locale,
            },
            {
                action: "issue_invoice",
                subject_type: "order",
                subject_id: order.id,
                lead_id: order.lead_id,
                origin: order.origin === "simulated" ? "simulated" : "live",
                dedupeKey: `issue_invoice:order:${order.id}`,
                seed: { amount_vnd: order.amount_vnd, fields: {} },
                queue: true,
            },
        )
        if (item.status === "done") throw new DecisionsError({ code: DecisionsErrorCode.StateChanged })
        const result = await this.entityManager.transaction(async (tx) => {
            if (item.status === "failed" || item.status === "rejected") {
                const changed = await this.items.retry(request.workspaceId, item.id, ["failed", "rejected"], tx)
                if (changed === null) throw new DecisionsError({ code: DecisionsErrorCode.StateChanged })
            }
            const result = await this.enqueue(principalId, request, item, tx, "handoff")
            await this.log(
                request,
                member,
                item,
                "handoff.accounting",
                this.catalog.get("sales.handoff", { who: member.displayName, no: order.order_no }, request.locale),
                tx,
            )
            return result
        })
        return result
    }

    private async requireDecide(principalId: string, workspaceId: string, item: WorkItem): Promise<WorkspaceMember> {
        const member = await this.members.require(principalId, workspaceId)
        if (
            !canDecide(member, {
                assigneeKind: item.assigned_staff_id === null ? null : "staff",
                assigneeId: item.assigned_staff_id,
            })
        )
            throw new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        return member
    }

    private async enqueue(
        principalId: string,
        request: SalesItemRequest,
        item: WorkItem,
        tx: EntityManager,
        intent: "retry" | "handoff",
    ): Promise<SalesAction> {
        const requestId = `${item.id}:${item.updated_at}`
        await this.queue.enqueueRunWork(
            {
                workspaceId: request.workspaceId,
                userId: principalId,
                locale: request.locale,
                workItemId: item.id,
                requestId,
                intent,
            },
            tx,
        )
        return this.status.queued(tx, request.workspaceId, decisionsDedupeKey(DecisionsJob.RunWork, requestId))
    }

    private log(
        request: SalesItemRequest,
        member: WorkspaceMember,
        item: WorkItem,
        kind: string,
        summary: string,
        manager: EntityManager = this.entityManager,
    ): Promise<void> {
        return this.evidence.log(
            { workspaceId: request.workspaceId, actor: member.displayName, locale: request.locale },
            {
                lead_id: item.lead_id,
                work_item_id: item.id,
                kind,
                actor: member.displayName,
                summary,
                evidence: item.error,
            },
            manager,
        )
    }
}
