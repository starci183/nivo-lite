import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ContentPillar, ContentPillarDraft } from "./content-pillars.contracts"
import { toContentPillar } from "./content-pillars.mapper"
import type { ContentPillarRow } from "./persistence/content-pillars.rows"
import {
    SELECT_CONFIGURATION_PILLARS,
    DELETE_CONFIGURATION_PILLARS,
    STAGE_CONFIGURATION_PILLAR_NAMES,
    SAVE_CONFIGURATION_PILLARS,
} from "./persistence/content-pillars.sql"

@Injectable()
/** The sole owner of content_pillars reads and writes. */
export class ContentPillarsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Lists saved themes for authorized application orchestration. */
    async list(workspaceId: string, transaction: EntityManager = this.entityManager): Promise<Array<ContentPillar>> {
        const rows = await transaction.query<Array<ContentPillarRow>>(SELECT_CONFIGURATION_PILLARS, [workspaceId])
        return rows.map(toContentPillar)
    }

    /** Replaces themes inside the caller's workspace configuration transaction. */
    async replace(
        transaction: EntityManager,
        workspaceId: string,
        rows: ReadonlyArray<ContentPillarDraft>,
    ): Promise<void> {
        const retainedIds = rows.flatMap((row) => (row.id === undefined ? [] : [row.id]))
        await transaction.query(DELETE_CONFIGURATION_PILLARS, [workspaceId, retainedIds])
        await transaction.query(STAGE_CONFIGURATION_PILLAR_NAMES, [workspaceId, retainedIds])
        await transaction.query(SAVE_CONFIGURATION_PILLARS, [
            workspaceId,
            JSON.stringify(
                rows.map((row, sort) => ({
                    ...row,
                    name: row.name.trim(),
                    description: row.description.trim(),
                    sort,
                })),
            ),
        ])
    }
}
