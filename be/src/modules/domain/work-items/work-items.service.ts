import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { WorkItemEntity } from "./persistence/entities"
import { CLAIM_LEASE_SECONDS } from "./work-items.contracts"
import type {
    AccountingWork,
    ClosedClaim,
    DoneMark,
    NewWorkItem,
    OptionalWorkItem,
    PreparedSave,
    Proposal,
    StillWaitingMark,
    WaitingMark,
    WorkItem,
    WorkItemKey,
    WorkItemRecord,
    WorkResult,
} from "./work-items.contracts"
import type { InboundWorkState } from "./inbound-work-state.contracts"
import { requireWorkItem, toWorkItem, toWorkItemRecord } from "./work-items.mapper"

/** The staff member an item is given to, or null when the assignment is cleared. */
type AssignedStaff = string | null

/** The most steps one customer journey read returns. */
const LEAD_ITEMS_MAX = 500

/** An item nobody touched since it was written, or whose last touch is older than the lease: free to take. */
const FREE_TO_TAKE =
    "(w.updated_at = w.created_at OR w.updated_at < CAST(:now AS timestamptz) - make_interval(secs => CAST(:lease AS int)))"

/** The same rule for the guarded updates, which have no alias. */
const FREE_TO_TAKE_UNALIASED =
    "(updated_at = created_at OR updated_at < CAST(:now AS timestamptz) - make_interval(secs => CAST(:lease AS int)))"

@Injectable()
/** The work items of a workspace: the only writer of public.work_items. */
export class WorkItemsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
    ) {}

    /** The newest steps shown by the Sales workbench. */
    async listForWorkbench(workspaceId: string, limit: number = 400): Promise<Array<WorkItem>> {
        const rows = await this.entityManager.find(WorkItemEntity, {
            where: { workspaceId },
            order: { createdAt: "DESC", id: "DESC" },
            take: Math.min(1000, Math.max(1, limit)),
        })
        return rows.map((row) => toWorkItem(toWorkItemRecord(row)))
    }

    /** The chronological steps shown by one customer's journey. */
    async listForLead(workspaceId: string, leadId: string): Promise<Array<WorkItem>> {
        const rows = await this.entityManager.find(WorkItemEntity, {
            where: { workspaceId, leadId },
            order: { createdAt: "ASC", id: "ASC" },
            take: LEAD_ITEMS_MAX,
        })
        return rows.map((row) => toWorkItem(toWorkItemRecord(row)))
    }

    /** Requeues a step only while it is in one of the caller's allowed failed states. */
    async retry(
        workspaceId: string,
        id: string,
        from: ReadonlyArray<WorkItem["status"]>,
        tx: EntityManager = this.entityManager,
    ): Promise<OptionalWorkItem> {
        return this.first(
            await this.changed(
                tx,
                { workspaceId, id },
                "status = ANY(:allowed)",
                { allowed: [...from] },
                {
                    status: "queued",
                    error: null,
                    reason: null,
                    reasons: [],
                    completedAt: null,
                    updatedAt: () => "created_at",
                },
            ),
        )
    }

    /** Permanently stops a failed step; null if another caller changed it first. */
    async stopFailed(
        workspaceId: string,
        id: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalWorkItem> {
        const now = this.now()
        return this.first(
            await this.changed(
                manager,
                { workspaceId, id },
                "status = 'failed'",
                {},
                {
                    status: "rejected",
                    completedAt: now,
                    updatedAt: now,
                },
            ),
        )
    }

    /** The newest accounting work items' lineage for the accounting book. */
    listAccounting(workspaceId: string, limit: number = 500): Promise<Array<AccountingWork>> {
        return this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select([
                "w.id AS id",
                "w.action AS action",
                "w.status AS status",
                "w.subject_type AS subject_type",
                "w.subject_id AS subject_id",
                "to_json(w.created_at) #>> '{}' AS created_at",
            ])
            .where("w.workspace_id = :workspaceId AND w.department = 'accounting'", { workspaceId })
            .orderBy("w.created_at", "DESC")
            .addOrderBy("w.id", "DESC")
            .limit(limit)
            .getRawMany<AccountingWork>()
    }

    /**
     * Inserts a queued item; null when the dedupe key of the workspace is already used. A root item is the root of its own chain,
     * so the id is minted here to name the chain in the same statement.
     */
    async insert(item: NewWorkItem, manager: EntityManager = this.entityManager): Promise<OptionalWorkItem> {
        const id = this.ids.next()
        const result = await manager
            .createQueryBuilder(WorkItemEntity, "w")
            .insert()
            .values({
                id,
                workspaceId: item.workspaceId,
                chainId: item.chainId ?? id,
                depth: item.depth,
                department: item.department,
                action: item.action,
                subjectType: item.subjectType,
                subjectId: item.subjectId,
                leadId: item.leadId,
                inboundEventId: item.inboundEventId,
                parentId: item.parentId,
                dedupeKey: item.dedupeKey,
                status: "queued",
                proposal: item.proposal,
                installationId: item.installationId,
            })
            .orIgnore()
            .returning("*")
            .execute()
        return this.first(result.raw as Array<WorkItemRecord>)
    }

    /** The item a dedupe key stands for. */
    async findByDedupe(
        workspaceId: string,
        dedupeKey: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalWorkItem> {
        const row = await manager.findOne(WorkItemEntity, { where: { workspaceId, dedupeKey } })
        return row === null ? null : toWorkItem(toWorkItemRecord(row))
    }

    /** The newest item of an action whose dedupe key is `baseKey` or one of its `baseKey:<suffix>` repeats. */
    async latestOfKey(workspaceId: string, action: string, baseKey: string): Promise<OptionalWorkItem> {
        const row = await this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .where("w.workspace_id = :workspaceId AND w.action = :action", { workspaceId, action })
            .andWhere(
                "(w.dedupe_key = CAST(:baseKey AS text) OR left(w.dedupe_key, length(CAST(:baseKey AS text)) + 1) = CAST(:baseKey AS text) || ':')",
                { baseKey },
            )
            .orderBy("w.created_at", "DESC")
            .addOrderBy("w.id", "DESC")
            .limit(1)
            .getOne()
        return row === null ? null : toWorkItem(toWorkItemRecord(row))
    }

    /** Takes a queued item for processing; null when another worker holds it. The lease is CLAIM_LEASE_SECONDS. */
    async claim(workspaceId: string, id: string): Promise<OptionalWorkItem> {
        const now = this.now()
        return this.first(
            await this.changed(
                this.entityManager,
                { workspaceId, id },
                `status = 'queued' AND ${FREE_TO_TAKE_UNALIASED}`,
                { now, lease: CLAIM_LEASE_SECONDS },
                { updatedAt: now },
            ),
        )
    }

    /** The oldest queued chain step of the workspace that is free to take. */
    async nextQueued(workspaceId: string): Promise<OptionalWorkItem> {
        const row = await this.freeQueued(workspaceId).getOne()
        return row === null ? null : toWorkItem(toWorkItemRecord(row))
    }

    /** Up to `limit` workspaces with a queued chain step free to take, the one waiting longest first. */
    async workspacesWithQueued(limit: number): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.workspace_id", "workspace_id")
            .where("w.status = 'queued' AND w.reason IS NULL")
            .andWhere(FREE_TO_TAKE, { now: this.now(), lease: CLAIM_LEASE_SECONDS })
            .groupBy("w.workspace_id")
            .orderBy("min(w.created_at)", "ASC")
            .addOrderBy("w.workspace_id", "ASC")
            .limit(limit)
            .getRawMany<{ workspace_id: string }>()
        return rows.map((row) => row.workspace_id)
    }

    /** The oldest available queued step of this inbound input; never selects another event or a live input. */
    async nextInboundQueued(workspaceId: string, eventId: string): Promise<OptionalWorkItem> {
        const row = await this.freeQueued(workspaceId).andWhere("w.inbound_event_id = :eventId", { eventId }).getOne()
        return row === null ? null : toWorkItem(toWorkItemRecord(row))
    }

    /** Counts all steps of the input, including work leased to another attempt, so a worker never acknowledges unfinished work. */
    async inboundState(workspaceId: string, eventId: string): Promise<InboundWorkState> {
        const row = await this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select([
                "(COUNT(*) FILTER (WHERE w.status = 'queued'))::int AS queued",
                "(COUNT(*) FILTER (WHERE w.status = 'failed'))::int AS failed",
                "(COUNT(*) FILTER (WHERE w.status = 'waiting_decision'))::int AS waiting",
            ])
            .where("w.workspace_id = :workspaceId AND w.inbound_event_id = :eventId", { workspaceId, eventId })
            .getRawOne<InboundWorkState>()
        return row ?? { queued: 0, failed: 0, waiting: 0 }
    }

    /** Guarded transition of a decision: only an item that waits becomes queued again; null otherwise. */
    async reopen(workspaceId: string, id: string): Promise<OptionalWorkItem> {
        return this.first(
            await this.changed(
                this.entityManager,
                { workspaceId, id },
                "status = 'waiting_decision'",
                {},
                {
                    status: "queued",
                    updatedAt: this.now(),
                },
            ),
        )
    }

    /** Saves what the performer prepared and the address it corrected. */
    async savePrepared(id: string, prepared: PreparedSave): Promise<WorkItem> {
        return requireWorkItem(
            await this.changed(
                this.entityManager,
                { id },
                null,
                { subjectType: prepared.subjectType, subjectId: prepared.subjectId, leadId: prepared.leadId },
                {
                    proposal: prepared.proposal,
                    subjectType: () => "COALESCE(CAST(:subjectType AS text), subject_type)",
                    subjectId: () => "COALESCE(CAST(:subjectId AS uuid), subject_id)",
                    leadId: () => "COALESCE(CAST(:leadId AS uuid), lead_id)",
                    updatedAt: this.now(),
                },
            ),
        )
    }

    /** Marks an item failed. */
    async markFailed(id: string, error: string): Promise<WorkItem> {
        return requireWorkItem(
            await this.changed(
                this.entityManager,
                { id },
                null,
                {},
                { status: "failed", error, updatedAt: this.now() },
            ),
        )
    }

    /** Puts an item in front of a person. */
    async markWaiting(id: string, waiting: WaitingMark): Promise<WorkItem> {
        return requireWorkItem(
            await this.changed(
                this.entityManager,
                { id },
                null,
                {},
                {
                    status: "waiting_decision",
                    reason: waiting.reason,
                    reasons: [...waiting.reasons],
                    missingFields: [...waiting.missing],
                    proposal: waiting.proposal,
                    executionId: waiting.executionId,
                    decidedPath: null,
                    error: null,
                    updatedAt: this.now(),
                },
            ),
        )
    }

    /** Stores a hold note on an item that is still waiting, joining the caller's transaction when supplied. False when it is no longer waiting. */
    async hold(
        workspaceId: string,
        id: string,
        proposal: Proposal,
        manager: EntityManager = this.entityManager,
    ): Promise<boolean> {
        const rows = await this.changed(
            manager,
            { workspaceId, id },
            "status = 'waiting_decision'",
            {},
            {
                proposal,
                updatedAt: this.now(),
            },
            "id",
        )
        return rows[0] !== undefined
    }

    /** Assigns an item to a staff member, or clears the assignment. False when the item is not in the workspace. */
    async assign(workspaceId: string, id: string, staffId: AssignedStaff): Promise<boolean> {
        const rows = await this.changed(
            this.entityManager,
            { workspaceId, id },
            null,
            {},
            {
                assignedStaffId: staffId,
                updatedAt: this.now(),
            },
            "id",
        )
        return rows[0] !== undefined
    }

    /** Links the approval card that decided an item to it. */
    async attachExecution(workspaceId: string, id: string, executionId: string): Promise<void> {
        await this.entityManager.update(WorkItemEntity, { workspaceId, id }, { executionId })
    }

    /** Closes the "customer says they paid" checks still waiting for an invoice that was just paid; answers the closed items. */
    async settleClaims(
        workspaceId: string,
        settledBy: string,
        dedupePrefix: string,
        result: WorkResult,
    ): Promise<Array<ClosedClaim>> {
        const now = this.now()
        const closed = await this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .update()
            .set({
                status: "done",
                decidedPath: "auto",
                reason: "routine",
                completedAt: now,
                updatedAt: now,
                evidenceState: "verified",
                result,
            })
            .where(
                "workspace_id = :workspaceId AND action = 'reconcile_payment' AND status = 'waiting_decision' " +
                    "AND id <> :settledBy AND dedupe_key LIKE CAST(:dedupePrefix AS text) || '%'",
                { workspaceId, settledBy, dedupePrefix },
            )
            .returning("id, inbound_event_id")
            .execute()
        return closed.raw as Array<ClosedClaim>
    }

    /** Closes an item as done. */
    async markDone(id: string, done: DoneMark): Promise<WorkItem> {
        const now = this.now()
        const auto = "CAST(:path AS text) = 'auto'"
        return requireWorkItem(
            await this.changed(
                this.entityManager,
                { id },
                null,
                { path: done.path, leadId: done.leadId },
                {
                    status: "done",
                    decidedPath: done.path,
                    proposal: done.proposal,
                    result: done.result,
                    evidenceState: done.evidence,
                    completedAt: now,
                    updatedAt: now,
                    error: null,
                    leadId: () => "COALESCE(CAST(:leadId AS uuid), lead_id)",
                    // An automatic path also records the routine reason.
                    reason: () => `CASE WHEN ${auto} THEN 'routine' ELSE reason END`,
                    reasons: () => `CASE WHEN ${auto} THEN ARRAY['routine'] ELSE reasons END`,
                    missingFields: [],
                },
            ),
        )
    }

    /** Closes an item as rejected by a person. */
    async markRejected(id: string, proposal: Proposal, result: WorkResult): Promise<WorkItem> {
        const now = this.now()
        return requireWorkItem(
            await this.changed(
                this.entityManager,
                { id },
                null,
                {},
                {
                    status: "rejected",
                    decidedPath: "human",
                    proposal,
                    completedAt: now,
                    updatedAt: now,
                    result,
                },
            ),
        )
    }

    /** Puts an item back in front of the person who approved it because data is still missing. */
    async markStillWaiting(id: string, still: StillWaitingMark): Promise<void> {
        await this.changed(
            this.entityManager,
            { id },
            null,
            {},
            {
                status: "waiting_decision",
                proposal: still.proposal,
                missingFields: [...still.missing],
                reason: still.reason,
                reasons: [...still.reasons],
                updatedAt: this.now(),
            },
        )
    }

    private now(): Date {
        return this.clock.now()
    }

    private first(rows: ReadonlyArray<WorkItemRecord>): OptionalWorkItem {
        const row = rows[0]
        return row === undefined ? null : toWorkItem(row)
    }

    /** The oldest queued chain step of the workspace that is free to take; the caller narrows it further. */
    private freeQueued(workspaceId: string): SelectQueryBuilder<WorkItemEntity> {
        return this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .where("w.workspace_id = :workspaceId AND w.status = 'queued' AND w.reason IS NULL", { workspaceId })
            .andWhere(FREE_TO_TAKE, { now: this.now(), lease: CLAIM_LEASE_SECONDS })
            .orderBy("w.created_at", "ASC")
            .addOrderBy("w.id", "ASC")
            .limit(1)
    }

    /**
     * One guarded `UPDATE ... RETURNING`: the columns change only for the item the key names and only while the guard holds, and the
     * answer is the row as it was written (empty when the key or the guard did not match).
     */
    private async changed(
        manager: EntityManager,
        key: WorkItemKey,
        guard: string | null,
        parameters: Record<string, unknown>,
        set: QueryDeepPartialEntity<WorkItemEntity>,
        returning: string = "*",
    ): Promise<Array<WorkItemRecord>> {
        const keyed = key.workspaceId === undefined ? "id = :id" : "workspace_id = :workspaceId AND id = :id"
        const result = await manager
            .createQueryBuilder(WorkItemEntity, "w")
            .update()
            .set(set)
            .where(guard === null ? keyed : `${keyed} AND ${guard}`, key)
            .setParameters(parameters)
            .returning(returning)
            .execute()
        return result.raw as Array<WorkItemRecord>
    }
}
