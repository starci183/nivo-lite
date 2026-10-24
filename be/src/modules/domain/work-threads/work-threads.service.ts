import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { readConnection } from "@modules/platform/pagination"
import type { Connection, PageRequest } from "@modules/platform/pagination"
import { WorkThreadsError, WorkThreadsErrorCode } from "./errors/work-threads.error"
import type { OwnedIdRow, ThreadRow } from "./persistence/work-threads.rows"
import {
    FIND_LEAD,
    FIND_ORDER,
    FIND_THREAD,
    INSERT_THREAD,
    LIST_THREADS,
    LOCK_THREAD,
    SET_THREAD_STATUS,
} from "./persistence/work-threads.sql"
import { toThread } from "./thread.mapper"
import type { NewMemberThread, WorkThreadLeadFilter, ThreadStatus, WorkThread } from "./work-threads.contracts"

@Injectable()
/** The work threads of a workspace as rows: opening, finding, locking and the status of each; the only writer of work_threads. */
export class WorkThreadsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Opens a thread for a member id the caller already proved is an active member of the workspace; it joins the caller's transaction when it hands one. */
    async createFor(input: NewMemberThread, manager: EntityManager = this.entityManager): Promise<WorkThread> {
        if (input.leadId !== null) {
            const [lead] = await manager.query<Array<OwnedIdRow>>(FIND_LEAD, [input.workspaceId, input.leadId])
            if (lead === undefined) throw new WorkThreadsError({ code: WorkThreadsErrorCode.LeadNotFound })
        }
        if (input.orderId !== null) {
            const [order] = await manager.query<Array<OwnedIdRow>>(FIND_ORDER, [input.workspaceId, input.orderId])
            if (order === undefined) throw new WorkThreadsError({ code: WorkThreadsErrorCode.OrderNotFound })
        }
        const [row] = await manager.query<Array<ThreadRow>>(INSERT_THREAD, [
            input.workspaceId,
            input.title,
            input.leadId,
            input.orderId,
            input.memberId,
        ])
        if (row === undefined) throw new WorkThreadsError({ code: WorkThreadsErrorCode.NotStored })
        return toThread(row)
    }

    /** The thread of the workspace, or a refusal when the workspace has no such thread. */
    async find(workspaceId: string, threadId: string): Promise<WorkThread> {
        const [row] = await this.entityManager.query<Array<ThreadRow>>(FIND_THREAD, [workspaceId, threadId])
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
        const connection = await readConnection(request, scope, (parameters) =>
            this.entityManager.query<Array<ThreadRow>>(LIST_THREADS, [workspaceId, filter, ...parameters]),
        )
        return { nodes: connection.nodes.map(toThread), pageInfo: connection.pageInfo }
    }

    /** Locks the thread of the workspace for the rest of the caller's transaction, or refuses when it has no such thread. */
    async lock(manager: EntityManager, workspaceId: string, threadId: string): Promise<WorkThread> {
        const [row] = await manager.query<Array<ThreadRow>>(LOCK_THREAD, [workspaceId, threadId])
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
        await manager.query(SET_THREAD_STATUS, [workspaceId, threadId, status])
    }
}
