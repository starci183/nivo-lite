import { Injectable } from "@nestjs/common"
import { Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    ExtractionProgress,
    ExtractionRecord,
    ExtractionStart,
    ExtractionState,
    MaybeExtraction,
} from "./brain-extractions.contracts"
import { BrainExtractionEntity } from "./persistence/entities"

/** An extraction as the callers read it. */
const toRecord = (row: BrainExtractionEntity): ExtractionRecord => ({
    sourceId: row.sourceId,
    status: row.status,
    factsProposed: row.factsProposed,
    promptVersion: row.promptVersion,
    contentHash: row.contentHash,
    windowsTotal: row.windowsTotal,
    windowsDone: row.windowsDone,
    attempts: row.attempts,
    orphanFactIds: row.orphanFactIds,
})

@Injectable()
/** Where the reading of each document stands, so a text read with the same prompt is never read twice and a reading can resume. */
export class BrainExtractionsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The reading of a document. */
    async get(workspaceId: string, sourceId: string): Promise<MaybeExtraction> {
        const row = await this.entityManager.findOne(BrainExtractionEntity, { where: { workspaceId, sourceId } })
        return row === null ? null : toRecord(row)
    }

    /** Where the reading of every document of the workspace stands. */
    async states(workspaceId: string): Promise<ReadonlyArray<ExtractionState>> {
        const rows = await this.entityManager.find(BrainExtractionEntity, {
            select: { sourceId: true, status: true },
            where: { workspaceId },
            take: 500,
        })
        return rows.map((row) => ({ sourceId: row.sourceId, status: row.status }))
    }

    /** Starts the reading of a document from its first window. */
    async start(start: ExtractionStart): Promise<void> {
        await this.entityManager.upsert(
            BrainExtractionEntity,
            {
                sourceId: start.sourceId,
                workspaceId: start.workspaceId,
                status: "running",
                factsProposed: 0,
                error: null,
                model: null,
                promptVersion: start.promptVersion,
                contentHash: start.contentHash,
                windowsTotal: start.windowsTotal,
                windowsDone: 0,
                attempts: 0,
                orphanFactIds: [...start.orphanFactIds],
                updatedAt: () => "now()",
            },
            ["sourceId"],
        )
    }

    /** Saves how far the reading got. */
    async save(workspaceId: string, sourceId: string, progress: ExtractionProgress): Promise<void> {
        await this.entityManager.update(
            BrainExtractionEntity,
            { workspaceId, sourceId },
            {
                status: progress.status,
                windowsDone: progress.windowsDone,
                factsProposed: progress.factsProposed,
                windowsTotal: progress.windowsTotal,
                error: progress.error,
                attempts: progress.attempts,
                updatedAt: () => "now()",
            },
        )
    }

    /** Closes the reading as done. */
    async finish(workspaceId: string, sourceId: string, model: string): Promise<void> {
        await this.entityManager.update(
            BrainExtractionEntity,
            { workspaceId, sourceId },
            { status: "done", error: null, model, orphanFactIds: [], updatedAt: () => "now()" },
        )
    }

    /** Settles a reading that has not finished as failed, so it never stays running. */
    async fail(workspaceId: string, sourceId: string, note: string): Promise<void> {
        await this.entityManager.update(
            BrainExtractionEntity,
            { workspaceId, sourceId, status: Not("done") },
            { status: "failed", error: note, updatedAt: () => "now()" },
        )
    }
}
