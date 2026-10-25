import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { unwrapOutcome } from "@modules/platform/primitives"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import type { ApiTextSourceInput } from "./api-knowledge-sources.contracts"
import { KnowledgeSourcesError, KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import type { SourceRef } from "./knowledge-sources.contracts"
import { INSERT_API_TEXT_SOURCE } from "./persistence/api-knowledge-sources.sql"
import type { SourceIdRow } from "./persistence/knowledge-sources.rows"
import { SELECT_SOURCE } from "./persistence/knowledge-sources.sql"
import { normalizeSource } from "./source-input.policy"

@Injectable()
/** Knowledge writes of authenticated API requests, owned by the caller's fenced transaction. */
export class ApiKnowledgeSourcesService {
    constructor(private readonly queue: KnowledgeQueue) {}

    /** Stores the promised source id and its indexing job together, without borrowing a person's identity. */
    async addText(input: ApiTextSourceInput, tx: EntityManager): Promise<SourceRef> {
        const source = unwrapOutcome(
            normalizeSource(input.workspaceId, {
                kind: "text",
                title: input.title,
                content: input.content,
                topic: input.topic ?? undefined,
                tags: input.tags,
                visibility: input.visibility,
                origin: input.origin,
            }),
            KnowledgeSourcesError,
        )
        const [row] = await tx.query<Array<SourceIdRow>>(INSERT_API_TEXT_SOURCE, [
            input.sourceId,
            input.workspaceId,
            source.topic,
            [...source.tags],
            source.visibility,
            source.title,
            source.content,
            source.origin,
        ])
        if (row === undefined) throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
        await this.queue.enqueueIndex({ sourceId: row.id, workspaceId: input.workspaceId }, tx)
        return { id: row.id }
    }

    /** Historical inline jobs already own a source; index that exact workspace-scoped row. */
    async indexExisting(workspaceId: string, sourceId: string, tx: EntityManager): Promise<void> {
        const [row] = await tx.query<Array<SourceIdRow>>(SELECT_SOURCE, [sourceId, workspaceId])
        if (row === undefined) throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
        await this.queue.enqueueIndex({ sourceId: row.id, workspaceId }, tx)
    }
}
