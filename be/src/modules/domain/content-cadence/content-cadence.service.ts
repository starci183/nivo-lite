import { Injectable } from "@nestjs/common"
import { In, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ContentCadence, ContentCadenceDraft } from "./content-cadence.contracts"
import { toContentCadence } from "./content-cadence.mapper"
import { ContentCadenceEntity } from "./persistence/entities"

@Injectable()
/** The sole owner of content_cadence reads and writes. */
export class ContentCadenceService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Lists saved posting rhythms for authorized application orchestration. */
    async list(workspaceId: string, transaction: EntityManager = this.entityManager): Promise<Array<ContentCadence>> {
        const rows = await transaction.find(ContentCadenceEntity, {
            where: { workspaceId },
            order: { channel: "ASC" },
            take: 4,
        })
        return rows.map(toContentCadence)
    }

    /** Replaces channels inside the caller's workspace configuration transaction. */
    async replace(
        transaction: EntityManager,
        workspaceId: string,
        rows: ReadonlyArray<ContentCadenceDraft>,
    ): Promise<void> {
        await transaction.delete(ContentCadenceEntity, {
            workspaceId,
            channel: Not(In(rows.map((row) => row.channel))),
        })
        if (rows.length === 0) return
        await transaction.upsert(
            ContentCadenceEntity,
            rows.map((row) => ({
                workspaceId,
                channel: row.channel,
                postsPerWeek: row.postsPerWeek,
                days: [...new Set(row.days)].sort((left, right) => left - right),
                postTime: row.time,
            })),
            ["workspaceId", "channel"],
        )
    }
}
