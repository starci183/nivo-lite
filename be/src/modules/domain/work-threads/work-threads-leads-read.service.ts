import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ThreadLead } from "./work-threads-leads-read.contracts"
import { WorkThreadEntity } from "./persistence/entities"

@Injectable()
/** Request-time reads of the customer behind threads for other capabilities, always scoped to the workspace and bounded by the caller. */
export class WorkThreadsLeadsReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The customer of each given thread of the workspace; a thread that does not exist is missing. */
    async leadsOf(workspaceId: string, threadIds: ReadonlyArray<string>): Promise<Array<ThreadLead>> {
        if (threadIds.length === 0) return []
        const rows = await this.entityManager.find(WorkThreadEntity, {
            select: { id: true, leadId: true },
            where: { workspaceId, id: In([...threadIds]) },
            take: threadIds.length,
        })
        return rows.map((row) => ({ id: row.id, leadId: row.leadId }))
    }
}
