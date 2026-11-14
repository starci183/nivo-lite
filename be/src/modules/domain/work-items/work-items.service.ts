import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectIds, type Ids } from "@modules/platform/ids"
import { WorkItemEntity } from "./persistence/entities"
import type {
    DoneMark,
    NewWorkItem,
    OptionalInstallationId,
    OptionalWorkItem,
    Proposal,
    WaitingMark,
    WorkItem,
    WorkItemKey,
    WorkItemRecord,
    WorkResult,
} from "./work-items.contracts"
import {
    firstWorkItem,
    queuedValuesOf,
    recordsOfRaw,
    requireWorkItem,
    toWorkItem,
    toWorkItemRecord,
} from "./work-items.mapper"

@Injectable()
/** The work items of a workspace (the items thread approvals write, `approve_tool_call`): the only writer of public.work_items. */
export class WorkItemsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
    ) {}

    /** The installation that owns a work item of the workspace; null when there is no such row or it names no installation. */
    async installationIdOf(workspaceId: string, id: string): Promise<OptionalInstallationId> {
        const row = await this.entityManager.findOne(WorkItemEntity, {
            select: { installationId: true },
            where: { workspaceId, id },
        })
        return row?.installationId ?? null
    }

    /** The items with these ids, at most `limit`; unknown ids are simply absent. */
    async findMany(ids: ReadonlyArray<string>, limit: number): Promise<Array<WorkItem>> {
        const rows = await this.entityManager.find(WorkItemEntity, { where: { id: In([...ids]) }, take: limit })
        return rows.map((row) => toWorkItem(toWorkItemRecord(row)))
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
            .values(queuedValuesOf(item, id))
            .orIgnore()
            .returning("*")
            .execute()
        return firstWorkItem(recordsOfRaw(result.raw))
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

    /** Guarded transition of a decision: only an item that waits becomes queued again; null otherwise. */
    async reopen(workspaceId: string, id: string): Promise<OptionalWorkItem> {
        return firstWorkItem(
            await this.changed(
                this.entityManager,
                { workspaceId, id },
                "status = 'waiting_decision'",
                {},
                {
                    status: "queued",
                    leasedAt: this.clock.now(),
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
                { status: "failed", error, leasedAt: this.clock.now() },
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
                    leasedAt: this.clock.now(),
                },
            ),
        )
    }

    /** Closes an item as done. */
    async markDone(id: string, done: DoneMark, manager: EntityManager = this.entityManager): Promise<WorkItem> {
        const now = this.clock.now()
        const auto = "CAST(:path AS text) = 'auto'"
        return requireWorkItem(
            await this.changed(
                manager,
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
                    leasedAt: now,
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
    async markRejected(
        id: string,
        proposal: Proposal,
        result: WorkResult,
        manager: EntityManager = this.entityManager,
    ): Promise<WorkItem> {
        const now = this.clock.now()
        return requireWorkItem(
            await this.changed(
                manager,
                { id },
                null,
                {},
                {
                    status: "rejected",
                    decidedPath: "human",
                    proposal,
                    completedAt: now,
                    leasedAt: now,
                    result,
                },
            ),
        )
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
        return recordsOfRaw(result.raw)
    }
}
