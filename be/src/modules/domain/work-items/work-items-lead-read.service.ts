import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkItemEntity } from "./persistence/entities"

@Injectable()
/** Request-time reads of the work waiting on one customer for other capabilities, always scoped to the workspace. */
export class WorkItemsLeadReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Whether an item of the action waits for a decision on the customer. */
    hasWaiting(workspaceId: string, leadId: string, action: string): Promise<boolean> {
        return this.entityManager.exists(WorkItemEntity, {
            where: { workspaceId, leadId, action, status: "waiting_decision" },
        })
    }
}
