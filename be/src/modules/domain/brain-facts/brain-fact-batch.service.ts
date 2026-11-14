import { Injectable } from "@nestjs/common"
import { IsNull, Like, type EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { FactRecord } from "./brain-facts.contracts"
import { bulkTagOf } from "./bulk-apply.policy"
import { toFactRecord } from "./fact-record.mapper"
import { BrainFactEntity } from "./persistence/entities"

/** The most facts one batch holds: a document files at most 200 per part, a bulk apply reads at most 2000 waiting ones. */
const BATCH_READ_MAX = 2000

@Injectable()
/** The facts applied together with others, taken back one at a time. */
export class BrainFactBatchService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * The facts of one batch still in force, read by the batch's tag on their decision note (never picked out of the newest facts in
     * force, which an older batch falls out of once thousands are in force). A rare founder action: read on the workspace's facts in
     * force (`brain_facts_ws_status`), filtered by the tag.
     */
    async inForce(workspaceId: string, batchId: string): Promise<ReadonlyArray<FactRecord>> {
        const rows = await this.entityManager.find(BrainFactEntity, {
            where: { workspaceId, status: "active", decisionNote: Like(`${bulkTagOf(batchId)}%`) },
            order: { id: "ASC" },
            take: BATCH_READ_MAX,
        })
        return rows.map((row) => toFactRecord(row))
    }

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
