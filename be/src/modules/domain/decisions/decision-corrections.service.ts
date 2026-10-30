import type { Correction, CorrectionSource } from "@modules/domain/brain"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { toCorrection } from "./correction.mapper"
import type { CorrectionRow } from "./persistence/corrections.rows"
import { DecisionEntity } from "./persistence/entities"

@Injectable()
/** Supplies the brain with the recent corrections held in the workspace's decision log. */
export class DecisionCorrectionsService implements CorrectionSource {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The edited and rejected decisions of one module since this instant, newest first, up to the limit. */
    async recent(workspaceId: string, module: string, since: Date, limit: number): Promise<ReadonlyArray<Correction>> {
        const rows = await this.entityManager
            .createQueryBuilder(DecisionEntity, "d")
            .select("d.id", "id")
            .addSelect("d.department", "department")
            .addSelect("d.action", "action")
            .addSelect("d.outcome", "outcome")
            .addSelect("d.note", "note")
            .addSelect("to_json(d.createdAt) #>> '{}'", "created_at")
            .addSelect("d.before", "before")
            .addSelect("d.after", "after")
            .where("d.workspaceId = :workspaceId AND d.department = :module", { workspaceId, module })
            .andWhere("d.outcome IN ('edited', 'rejected') AND d.createdAt >= :since", { since })
            .orderBy("d.createdAt", "DESC")
            .limit(limit)
            .getRawMany<CorrectionRow>()
        return rows.map(toCorrection)
    }
}
