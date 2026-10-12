import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { WorkItemRow } from "./persistence/work-items.rows"
import {
    CLAIM_WORK_ITEM,
    FIND_WORK_ITEM_BY_DEDUPE,
    INSERT_WORK_ITEM,
    MARK_WORK_ITEM_DONE,
    MARK_WORK_ITEM_FAILED,
    MARK_WORK_ITEM_REJECTED,
    MARK_WORK_ITEM_STILL_WAITING,
    MARK_WORK_ITEM_WAITING,
    NEXT_QUEUED_WORK_ITEM,
    REOPEN_WAITING_WORK_ITEM,
    SAVE_PREPARED_WORK_ITEM,
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
import { requireWorkItem, toWorkItem } from "./work-items.mapper"

@Injectable()
/** The work items of a workspace: the only writer of public.work_items. */
export class WorkItemsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

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
