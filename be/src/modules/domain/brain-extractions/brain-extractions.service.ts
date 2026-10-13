import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    ExtractionProgress,
    ExtractionRecord,
    ExtractionStart,
    ExtractionState,
    MaybeExtraction,
} from "./brain-extractions.contracts"
import type { BrainExtractionRow, ExtractionStateRow } from "./persistence/brain-extractions.rows"
import {
    FINISH_EXTRACTION,
    LIST_EXTRACTIONS,
    SAVE_PROGRESS,
    SELECT_EXTRACTION,
    UPSERT_EXTRACTION,
} from "./persistence/brain-extractions.sql"

/** An extraction as the callers read it. */
const toRecord = (row: BrainExtractionRow): ExtractionRecord => ({
    sourceId: row.source_id,
    status: row.status,
    factsProposed: row.facts_proposed,
    promptVersion: row.prompt_version,
    contentHash: row.content_hash,
    windowsTotal: row.windows_total,
    windowsDone: row.windows_done,
    attempts: row.attempts,
    orphanFactIds: row.orphan_fact_ids ?? [],
})

@Injectable()
/** Where the reading of each document stands, so a text read with the same prompt is never read twice and a reading can resume. */
export class BrainExtractionsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The reading of a document. */
    async get(workspaceId: string, sourceId: string): Promise<MaybeExtraction> {
        const [row] = await this.entityManager.query<Array<BrainExtractionRow>>(SELECT_EXTRACTION, [
            workspaceId,
            sourceId,
        ])
        return row === undefined ? null : toRecord(row)
    }

    /** Where the reading of every document of the workspace stands. */
    async states(workspaceId: string): Promise<ReadonlyArray<ExtractionState>> {
        const rows = await this.entityManager.query<Array<ExtractionStateRow>>(LIST_EXTRACTIONS, [workspaceId])
        return rows.map((row) => ({ sourceId: row.source_id, status: row.status }))
    }

    /** Starts the reading of a document from its first window. */
    async start(start: ExtractionStart): Promise<void> {
        await this.entityManager.query(UPSERT_EXTRACTION, [
            start.workspaceId,
            start.sourceId,
            start.promptVersion,
            start.contentHash,
            start.windowsTotal,
            [...start.orphanFactIds],
        ])
    }

    /** Saves how far the reading got. */
    async save(workspaceId: string, sourceId: string, progress: ExtractionProgress): Promise<void> {
        await this.entityManager.query(SAVE_PROGRESS, [
            workspaceId,
            sourceId,
            progress.status,
            progress.windowsDone,
            progress.factsProposed,
            progress.windowsTotal,
            progress.error,
            progress.attempts,
        ])
    }

    /** Closes the reading as done. */
    async finish(workspaceId: string, sourceId: string, model: string): Promise<void> {
        await this.entityManager.query(FINISH_EXTRACTION, [workspaceId, sourceId, model])
    }
}
