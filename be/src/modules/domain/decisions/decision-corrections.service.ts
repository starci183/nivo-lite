import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { Correction, CorrectionSource } from "@modules/domain/brain"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { toCorrection } from "./correction.mapper"
import type { CorrectionRow } from "./persistence/corrections.rows"
import { LIST_RECENT_CORRECTIONS } from "./persistence/corrections.sql"

@Injectable()
/** Supplies the brain with the recent corrections held in the workspace's decision log. */
export class DecisionCorrectionsService implements CorrectionSource {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The edited and rejected decisions of one module since this instant, newest first, up to the limit. */
    async recent(workspaceId: string, module: string, since: Date, limit: number): Promise<ReadonlyArray<Correction>> {
        const rows = await this.entityManager.query<Array<CorrectionRow>>(LIST_RECENT_CORRECTIONS, [
            workspaceId,
            module,
            since.toISOString(),
            limit,
        ])
        return rows.map(toCorrection)
    }
}
