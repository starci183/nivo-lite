import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ThreadWorkEntity } from "./persistence/entities"

@Injectable()
/** Request-time reads of what agents' work in threads is linked to, for other capabilities, always scoped to the workspace and bounded by the caller. */
export class ThreadWorkLinksReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Which of the given approval requests an agent's work waits on. */
    async linkedRequestIds(workspaceId: string, requestIds: ReadonlyArray<string>): Promise<Array<string>> {
        if (requestIds.length === 0) return []
        const rows = await this.entityManager.find(ThreadWorkEntity, {
            select: { approvalRequestId: true },
            where: { workspaceId, approvalRequestId: In([...requestIds]) },
            take: requestIds.length,
        })
        return rows.flatMap((row) => (row.approvalRequestId === null ? [] : [row.approvalRequestId]))
    }

    /** Which of the given threads an agent's work runs in. */
    async workingThreadIds(workspaceId: string, threadIds: ReadonlyArray<string>): Promise<Array<string>> {
        if (threadIds.length === 0) return []
        const rows = await this.entityManager
            .createQueryBuilder(ThreadWorkEntity, "w")
            .select("DISTINCT w.threadId", "thread_id")
            .where("w.workspaceId = :workspaceId AND w.threadId IN (:...threadIds)", {
                workspaceId,
                threadIds: [...threadIds],
            })
            .limit(threadIds.length)
            .getRawMany<{ thread_id: string }>()
        return rows.map((row) => row.thread_id)
    }
}
