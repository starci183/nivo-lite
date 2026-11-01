import { Injectable } from "@nestjs/common"
import { IsNull, Like } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { bulkTagOf } from "./bulk-apply.policy"
import { BrainFactEntity } from "./persistence/entities"

@Injectable()
/** The facts applied together with others, taken back one at a time. */
export class BrainFactBatchService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * Takes a fact applied together with others back to a proposal, as it was before: it is waiting again, with nobody's decision on it. Only a
     * fact of that batch that is still in force and replaced nothing can go back; one that was retired, replaced or decided again since stays as it is.
     * Answers whether the fact went back.
     */
    async reopen(workspaceId: string, id: string, batchId: string): Promise<boolean> {
        const reopened = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "bf")
            .update()
            .set({
                status: "proposed",
                decidedBy: null,
                decidedAt: null,
                decisionNote: null,
                // Applying stamped the start with the instant of the decision when the document gave none: that is not the document's date.
                validFrom: () => "CASE WHEN valid_from = decided_at THEN NULL ELSE valid_from END",
            })
            .where({
                workspaceId,
                id,
                status: "active",
                supersedesId: IsNull(),
                decisionNote: Like(`${bulkTagOf(batchId)}%`),
            })
            .returning("id")
            .execute()
        return Array.isArray(reopened.raw) && reopened.raw.length > 0
    }
}
