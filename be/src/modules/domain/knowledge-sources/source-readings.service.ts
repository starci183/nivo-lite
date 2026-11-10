import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { MaybeReading, SourceReading } from "./knowledge-sources.contracts"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { readingOf } from "./source-record.mapper"

@Injectable()
/** How the last reading of each file went (the reader, pages, sheets, transcribed pages, warnings, the reason of a refusal). */
export class SourceReadingsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** How the last reading of a source went, or null when it has none or the source is gone. */
    async reading(workspaceId: string, sourceId: string): Promise<MaybeReading> {
        const row = await this.entityManager.findOne(KnowledgeSourceEntity, {
            select: { id: true, reading: true },
            where: { id: sourceId, workspaceId },
        })
        return row === null ? null : readingOf(row.reading)
    }

    /** Keeps how the last reading of a file went, for the second-brain page. */
    async record(workspaceId: string, sourceId: string, reading: SourceReading): Promise<void> {
        await this.entityManager.update(
            KnowledgeSourceEntity,
            { id: sourceId, workspaceId },
            { reading: { ...reading } },
        )
    }
}
