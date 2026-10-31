import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { findRowsOfIds, InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ThreadLead } from "./work-threads-leads-read.contracts"
import { WorkThreadEntity } from "./persistence/entities"

@Injectable()
/** Request-time reads of the customer behind threads for other capabilities, always scoped to the workspace and bounded by the caller. */
export class WorkThreadsLeadsReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The customer of each given thread of the workspace; a thread that does not exist is missing. */
    async leadsOf(workspaceId: string, threadIds: ReadonlyArray<string>): Promise<Array<ThreadLead>> {
        const rows = await findRowsOfIds(
            this.entityManager,
            WorkThreadEntity,
            { workspaceId, id: In([...threadIds]) },
            { id: true, leadId: true },
            threadIds,
        )
        return rows.map((row) => ({ id: row.id, leadId: row.leadId }))
    }
}
