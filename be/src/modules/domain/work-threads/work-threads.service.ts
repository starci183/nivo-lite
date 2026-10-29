import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { readConnection } from "@modules/platform/pagination"
import type { Connection, PageRequest } from "@modules/platform/pagination"
import { WorkThreadsError, WorkThreadsErrorCode } from "./errors/work-threads.error"
import { WorkThreadEntity } from "./persistence/entities"
import { THREAD_RETURNING, selectThreads } from "./persistence/work-thread.query"
import { toThread } from "./thread.mapper"
import type {
    NewMemberThread,
    ThreadStatus,
    WorkThread,
    WorkThreadLeadFilter,
    WorkThreadRecord,
} from "./work-threads.contracts"

@Injectable()
/** The work threads of a workspace as rows: opening, finding, locking and the status of each; the only writer of work_threads. */
export class WorkThreadsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Opens a thread for a member id the caller already proved is an active member of the workspace; it joins the caller's transaction when it hands one. */
    async createFor(input: NewMemberThread, manager: EntityManager = this.entityManager): Promise<WorkThread> {
        if (input.leadId !== null) {
            const lead = await this.ownedId(manager, "public.leads", input.workspaceId, input.leadId)
            if (lead === undefined) throw new WorkThreadsError({ code: WorkThreadsErrorCode.LeadNotFound })
        }
        if (input.orderId !== null) {
            const order = await this.ownedId(manager, "public.orders", input.workspaceId, input.orderId)
            if (order === undefined) throw new WorkThreadsError({ code: WorkThreadsErrorCode.OrderNotFound })
        }
        const result = await manager
            .createQueryBuilder(WorkThreadEntity, "w")
            .insert()
            .values({
                workspaceId: input.workspaceId,
                title: input.title,
                leadId: input.leadId,
                orderId: input.orderId,
                createdBy: input.memberId,
            })
            .returning(THREAD_RETURNING)
            .execute()
        const [row] = result.raw as Array<WorkThreadRecord>
        if (row === undefined) throw new WorkThreadsError({ code: WorkThreadsErrorCode.NotStored })
        return toThread(row)
    }

    /** The thread of the workspace, or a refusal when the workspace has no such thread. */
    async find(workspaceId: string, threadId: string): Promise<WorkThread> {
        const row = await selectThreads(this.entityManager, workspaceId)
            .andWhere("t.id = :threadId", { threadId })
            .limit(1)
            .getRawOne<WorkThreadRecord>()
        if (row === undefined) throw new WorkThreadsError({ code: WorkThreadsErrorCode.ThreadNotFound })
        return toThread(row)
    }

    /** The newest threads of the workspace, optionally only those about one lead. */
    async list(
        workspaceId: string,
        leadId: WorkThreadLeadFilter,
        request: PageRequest = {},
    ): Promise<Connection<WorkThread>> {
        const filter = leadId ?? null
        const scope = `${workspaceId}:workThreads:${filter ?? "all"}`
        const connection = await readConnection(request, scope, ([cursorAt, cursorId, limit]) => {
            const read = selectThreads(this.entityManager, workspaceId)
            if (filter !== null) read.andWhere("t.lead_id = :leadId", { leadId: filter })
            if (cursorAt !== null && cursorId !== null) {
                read.andWhere("(t.created_at, t.id) < (CAST(:cursorAt AS timestamptz), CAST(:cursorId AS uuid))", {
                    cursorAt,
                    cursorId,
                })
            }
            return read
                .orderBy("t.created_at", "DESC")
                .addOrderBy("t.id", "DESC")
                .limit(limit)
                .getRawMany<WorkThreadRecord>()
        })
        return { nodes: connection.nodes.map(toThread), pageInfo: connection.pageInfo }
    }

    /** Locks the thread of the workspace for the rest of the caller's transaction, or refuses when it has no such thread. */
    async lock(manager: EntityManager, workspaceId: string, threadId: string): Promise<WorkThread> {
        const row = await selectThreads(manager, workspaceId)
            .andWhere("t.id = :threadId", { threadId })
            .limit(1)
            .setLock("pessimistic_write")
            .getRawOne<WorkThreadRecord>()
        if (row === undefined) throw new WorkThreadsError({ code: WorkThreadsErrorCode.ThreadNotFound })
        return toThread(row)
    }

    /** Sets where a thread stands and marks it changed, inside the caller's transaction. */
    async setStatus(
        manager: EntityManager,
        workspaceId: string,
        threadId: string,
        status: ThreadStatus,
    ): Promise<void> {
        await manager.update(WorkThreadEntity, { workspaceId, id: threadId }, { status, updatedAt: () => "now()" })
    }

    private ownedId(
        manager: EntityManager,
        table: "public.leads" | "public.orders",
        workspaceId: string,
        id: string,
    ): Promise<{ id: string } | undefined> {
        return manager
            .createQueryBuilder()
            .select("x.id", "id")
            .from(table, "x")
            .where("x.workspace_id = :workspaceId AND x.id = :id", { workspaceId, id })
            .limit(1)
            .getRawOne<{ id: string }>()
    }
}
