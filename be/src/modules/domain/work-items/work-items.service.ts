import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { AccountingWorkRow, ClosedClaimRow, WorkItemRow } from "./persistence/work-items.rows"
import {
    ASSIGN_WORK_ITEM,
    ATTACH_WORK_ITEM_EXECUTION,
    HOLD_WORK_ITEM,
    CLAIM_WORK_ITEM,
    FIND_WORK_ITEM_BY_DEDUPE,
    INSERT_WORK_ITEM,
    LIST_LEAD_ITEMS,
    LIST_WORKBENCH_ITEMS,
    LIST_ACCOUNTING_WORK_ITEMS,
    MARK_WORK_ITEM_DONE,
    MARK_WORK_ITEM_FAILED,
    MARK_WORK_ITEM_REJECTED,
    MARK_WORK_ITEM_STILL_WAITING,
    MARK_WORK_ITEM_WAITING,
    NEXT_QUEUED_WORK_ITEM,
    REOPEN_WAITING_WORK_ITEM,
    RETRY_WORK_ITEM,
    SAVE_PREPARED_WORK_ITEM,
    SETTLE_WAITING_CLAIMS,
    STOP_FAILED_WORK_ITEM,
    NEXT_INBOUND_QUEUED_WORK_ITEM,
    READ_INBOUND_WORK_STATE,
} from "./persistence/work-items.sql"
import { CLAIM_LEASE_SECONDS } from "./work-items.contracts"
import type {
    DoneMark,
    NewWorkItem,
    OptionalWorkItem,
    PreparedSave,
    Proposal,
    StillWaitingMark,
    WaitingMark,
    WorkItem,
    WorkResult,
} from "./work-items.contracts"
import type { InboundWorkState } from "./inbound-work-state.contracts"
import { requireWorkItem, toWorkItem } from "./work-items.mapper"

/** The staff member an item is given to, or null when the assignment is cleared. */
type AssignedStaff = string | null

@Injectable()
/** The work items of a workspace: the only writer of public.work_items. */
export class WorkItemsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** The newest steps shown by the Sales workbench. */
    async listForWorkbench(workspaceId: string, limit: number = 400): Promise<Array<WorkItem>> {
        const rows = await this.entityManager.query<Array<WorkItemRow>>(LIST_WORKBENCH_ITEMS, [
            workspaceId,
            Math.min(1000, Math.max(1, limit)),
        ])
        return rows.map(toWorkItem)
    }

    /** The chronological steps shown by one customer's journey. */
    async listForLead(workspaceId: string, leadId: string): Promise<Array<WorkItem>> {
        const rows = await this.entityManager.query<Array<WorkItemRow>>(LIST_LEAD_ITEMS, [workspaceId, leadId])
        return rows.map(toWorkItem)
    }

    /** Requeues a step only while it is in one of the caller's allowed failed states. */
    async retry(
        workspaceId: string,
        id: string,
        from: ReadonlyArray<WorkItem["status"]>,
        tx: EntityManager = this.entityManager,
    ): Promise<OptionalWorkItem> {
        return this.first(await tx.query<Array<WorkItemRow>>(RETRY_WORK_ITEM, [workspaceId, id, from]))
    }

    /** Permanently stops a failed step; null if another caller changed it first. */
    async stopFailed(
        workspaceId: string,
        id: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalWorkItem> {
        return this.first(await manager.query<Array<WorkItemRow>>(STOP_FAILED_WORK_ITEM, [workspaceId, id, this.now()]))
    }

    /** The newest accounting work items' lineage for the accounting book. */
    listAccounting(workspaceId: string, limit: number = 500): Promise<Array<AccountingWorkRow>> {
        return this.entityManager.query<Array<AccountingWorkRow>>(LIST_ACCOUNTING_WORK_ITEMS, [workspaceId, limit])
    }

    /** Inserts a queued item; null when the dedupe key of the workspace is already used. The id comes from the database. */
    async insert(item: NewWorkItem): Promise<OptionalWorkItem> {
        return this.first(
            await this.entityManager.query<Array<WorkItemRow>>(INSERT_WORK_ITEM, [
                item.workspaceId,
                item.chainId,
                item.depth,
                item.department,
                item.action,
                item.subjectType,
                item.subjectId,
                item.leadId,
                item.inboundEventId,
                item.parentId,
                item.dedupeKey,
                JSON.stringify(item.proposal),
                item.origin,
                item.installationId,
            ]),
        )
    }

    /** The item a dedupe key stands for. */
    async findByDedupe(workspaceId: string, dedupeKey: string): Promise<OptionalWorkItem> {
        return this.first(
            await this.entityManager.query<Array<WorkItemRow>>(FIND_WORK_ITEM_BY_DEDUPE, [workspaceId, dedupeKey]),
        )
    }

    /** Takes a queued item for processing; null when another worker holds it. The lease is CLAIM_LEASE_SECONDS. */
    async claim(workspaceId: string, id: string): Promise<OptionalWorkItem> {
        return this.first(
            await this.entityManager.query<Array<WorkItemRow>>(CLAIM_WORK_ITEM, [
                id,
                workspaceId,
                this.now(),
                CLAIM_LEASE_SECONDS,
            ]),
        )
    }

    /** The oldest queued chain step of the workspace that is free to take. */
    async nextQueued(workspaceId: string): Promise<OptionalWorkItem> {
        return this.first(
            await this.entityManager.query<Array<WorkItemRow>>(NEXT_QUEUED_WORK_ITEM, [
                workspaceId,
                this.now(),
                CLAIM_LEASE_SECONDS,
            ]),
        )
    }

    /** The oldest available queued step of this inbound input; never selects another event or a live input. */
    async nextInboundQueued(workspaceId: string, eventId: string): Promise<OptionalWorkItem> {
        return this.first(
            await this.entityManager.query<Array<WorkItemRow>>(NEXT_INBOUND_QUEUED_WORK_ITEM, [
                workspaceId,
                eventId,
                this.now(),
                CLAIM_LEASE_SECONDS,
            ]),
        )
    }

    /** Counts all steps of the input, including work leased to another attempt, so a worker never acknowledges unfinished work. */
    async inboundState(workspaceId: string, eventId: string): Promise<InboundWorkState> {
        const [row] = await this.entityManager.query<Array<InboundWorkState>>(READ_INBOUND_WORK_STATE, [
            workspaceId,
            eventId,
        ])
        return row ?? { queued: 0, failed: 0, waiting: 0 }
    }

    /** Guarded transition of a decision: only an item that waits becomes queued again; null otherwise. */
    async reopen(workspaceId: string, id: string): Promise<OptionalWorkItem> {
        return this.first(
            await this.entityManager.query<Array<WorkItemRow>>(REOPEN_WAITING_WORK_ITEM, [id, workspaceId, this.now()]),
        )
    }

    /** Saves what the performer prepared and the address it corrected. */
    async savePrepared(id: string, prepared: PreparedSave): Promise<WorkItem> {
        return requireWorkItem(
            await this.entityManager.query<Array<WorkItemRow>>(SAVE_PREPARED_WORK_ITEM, [
                id,
                JSON.stringify(prepared.proposal),
                prepared.subjectType,
                prepared.subjectId,
                prepared.leadId,
                this.now(),
            ]),
        )
    }

    /** Marks an item failed. */
    async markFailed(id: string, error: string): Promise<WorkItem> {
        return requireWorkItem(
            await this.entityManager.query<Array<WorkItemRow>>(MARK_WORK_ITEM_FAILED, [id, error, this.now()]),
        )
    }

    /** Puts an item in front of a person. */
    async markWaiting(id: string, waiting: WaitingMark): Promise<WorkItem> {
        return requireWorkItem(
            await this.entityManager.query<Array<WorkItemRow>>(MARK_WORK_ITEM_WAITING, [
                id,
                waiting.reason,
                waiting.reasons,
                waiting.missing,
                JSON.stringify(waiting.proposal),
                waiting.executionId,
                this.now(),
            ]),
        )
    }

    /** Stores a hold note on an item that is still waiting. False when it is no longer waiting. */
    async hold(workspaceId: string, id: string, proposal: Proposal): Promise<boolean> {
        const rows = await this.entityManager.query<Array<{ id: string }>>(HOLD_WORK_ITEM, [
            workspaceId,
            id,
            JSON.stringify(proposal),
            this.now(),
        ])
        return rows[0] !== undefined
    }

    /** Assigns an item to a staff member, or clears the assignment. False when the item is not in the workspace. */
    async assign(workspaceId: string, id: string, staffId: AssignedStaff): Promise<boolean> {
        const rows = await this.entityManager.query<Array<{ id: string }>>(ASSIGN_WORK_ITEM, [
            workspaceId,
            id,
            staffId,
            this.now(),
        ])
        return rows[0] !== undefined
    }

    /** Links the approval card that decided an item to it. */
    async attachExecution(workspaceId: string, id: string, executionId: string): Promise<void> {
        await this.entityManager.query(ATTACH_WORK_ITEM_EXECUTION, [workspaceId, id, executionId])
    }

    /** Closes the "customer says they paid" checks still waiting for an invoice that was just paid; answers the closed items. */
    settleClaims(
        workspaceId: string,
        settledBy: string,
        dedupePrefix: string,
        result: WorkResult,
    ): Promise<Array<ClosedClaimRow>> {
        return this.entityManager.query<Array<ClosedClaimRow>>(SETTLE_WAITING_CLAIMS, [
            workspaceId,
            settledBy,
            dedupePrefix,
            JSON.stringify(result),
            this.now(),
        ])
    }

    /** Closes an item as done. */
    async markDone(id: string, done: DoneMark): Promise<WorkItem> {
        return requireWorkItem(
            await this.entityManager.query<Array<WorkItemRow>>(MARK_WORK_ITEM_DONE, [
                id,
                done.path,
                JSON.stringify(done.proposal),
                JSON.stringify(done.result),
                done.evidence,
                this.now(),
                done.leadId,
            ]),
        )
    }

    /** Closes an item as rejected by a person. */
    async markRejected(id: string, proposal: Proposal, result: WorkResult): Promise<WorkItem> {
        return requireWorkItem(
            await this.entityManager.query<Array<WorkItemRow>>(MARK_WORK_ITEM_REJECTED, [
                id,
                JSON.stringify(proposal),
                this.now(),
                JSON.stringify(result),
            ]),
        )
    }

    /** Puts an item back in front of the person who approved it because data is still missing. */
    async markStillWaiting(id: string, still: StillWaitingMark): Promise<void> {
        await this.entityManager.query(MARK_WORK_ITEM_STILL_WAITING, [
            id,
            JSON.stringify(still.proposal),
            still.missing,
            still.reason,
            still.reasons,
            this.now(),
        ])
    }

    private now(): string {
        return this.clock.now().toISOString()
    }

    private first(rows: ReadonlyArray<WorkItemRow>): OptionalWorkItem {
        const row = rows[0]
        return row === undefined ? null : toWorkItem(row)
    }
}
