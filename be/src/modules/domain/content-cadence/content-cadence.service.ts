import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ContentCadence, ContentCadenceDraft } from "./content-cadence.contracts"
import { toContentCadence } from "./content-cadence.mapper"
import type { ContentCadenceRow } from "./persistence/content-cadence.rows"
import {
    SELECT_CONFIGURATION_CADENCE,
    DELETE_CONFIGURATION_CADENCE,
    SAVE_CONFIGURATION_CADENCE,
} from "./persistence/content-cadence.sql"

@Injectable()
/** The sole owner of content_cadence reads and writes. */
export class ContentCadenceService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Lists saved posting rhythms for authorized application orchestration. */
    async list(workspaceId: string, transaction: EntityManager = this.entityManager): Promise<Array<ContentCadence>> {
        const rows = await transaction.query<Array<ContentCadenceRow>>(SELECT_CONFIGURATION_CADENCE, [workspaceId])
        return rows.map(toContentCadence)
    }

    /** Replaces channels inside the caller's workspace configuration transaction. */
    async replace(
        transaction: EntityManager,
        workspaceId: string,
        rows: ReadonlyArray<ContentCadenceDraft>,
    ): Promise<void> {
        await transaction.query(DELETE_CONFIGURATION_CADENCE, [workspaceId, rows.map((row) => row.channel)])
        await transaction.query(SAVE_CONFIGURATION_CADENCE, [
            workspaceId,
            JSON.stringify(
                rows.map((row) => ({
                    channel: row.channel,
                    posts_per_week: row.postsPerWeek,
                    days: [...new Set(row.days)].sort((left, right) => left - right),
                    post_time: row.time,
                })),
            ),
        ])
    }
}
