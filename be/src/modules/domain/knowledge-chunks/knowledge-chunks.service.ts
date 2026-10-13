import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import type { ChunkWrite, EmbeddedChunk, StaleChunk, VectorWrite } from "./knowledge-chunks.contracts"
import type { EmbeddedChunkRow, StaleChunkRow } from "./persistence/knowledge-chunks.rows"
import {
    DELETE_CHUNKS,
    INSERT_CHUNKS,
    SELECT_EMBEDDED_CHUNKS,
    SELECT_STALE_CHUNKS,
    UPDATE_CHUNK_VECTORS,
} from "./persistence/knowledge-chunks.sql"

/** How many passages one insert statement stores. */
const INSERT_BATCH = 50

@Injectable()
/** The passages of a source: stored in place of the earlier ones, and given vectors when the model changes. */
export class KnowledgeChunksService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Replaces the passages of a source with these in one transaction; a passage without a vector is found by keyword only. */
    async replace(write: ChunkWrite): Promise<void> {
        await this.entityManager.transaction(async (tx) => {
            await tx.query(DELETE_CHUNKS, [write.sourceId, write.workspaceId])
            const starts = Array.from(
                { length: Math.ceil(write.drafts.length / INSERT_BATCH) },
                (_, index) => index * INSERT_BATCH,
            )
            await eachInOrder(starts, (from) => {
                const drafts = write.drafts.slice(from, from + INSERT_BATCH)
                return tx.query(INSERT_CHUNKS, [
                    write.workspaceId,
                    write.sourceId,
                    write.module,
                    write.visibility,
                    drafts.map((_, offset) => from + offset),
                    drafts.map((draft) => draft.text),
                    drafts.map((draft) => draft.vector),
                    drafts.map((draft) => (draft.vector === null ? null : write.model)),
                ])
            })
        })
    }

    /** The stored passages of a source that have a vector, in order. */
    async embeddedOf(workspaceId: string, sourceId: string): Promise<ReadonlyArray<EmbeddedChunk>> {
        const rows = await this.entityManager.query<Array<EmbeddedChunkRow>>(SELECT_EMBEDDED_CHUNKS, [
            sourceId,
            workspaceId,
        ])
        return rows.map((row) => ({ order: row.ord, text: row.content, model: row.embedding_model }))
    }

    /** Up to `limit` passages of a workspace that have no vector, or one made by another model than `model`. */
    async stale(workspaceId: string, model: string, limit: number): Promise<ReadonlyArray<StaleChunk>> {
        const rows = await this.entityManager.query<Array<StaleChunkRow>>(SELECT_STALE_CHUNKS, [
            workspaceId,
            model,
            limit,
        ])
        return rows.map((row) => ({ id: row.id, text: row.content }))
    }

    /** Gives passages their vectors. */
    async setVectors(write: VectorWrite): Promise<void> {
        await this.entityManager.query(UPDATE_CHUNK_VECTORS, [write.workspaceId, write.ids, write.vectors, write.model])
    }
}
