import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { unwrapOutcome } from "@modules/platform/primitives"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import type { ApiTextSourceInput } from "./api-knowledge-sources.contracts"
import { KnowledgeSourcesError, KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import type { SourceRef } from "./knowledge-sources.contracts"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { normalizeSource } from "./source-input.policy"
import { rawBytesOf } from "./source-quota.policy"
import { SourceQuotaService } from "./source-quota.service"

@Injectable()
/** Knowledge writes of authenticated API requests, owned by the caller's fenced transaction. */
export class ApiKnowledgeSourcesService {
    constructor(
        private readonly queue: KnowledgeQueue,
        private readonly quota: SourceQuotaService,
    ) {}

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
        const sizeBytes = rawBytesOf(source, 0)
        await this.quota.admit(tx, input.workspaceId, sizeBytes)
        const inserted = await tx.insert(KnowledgeSourceEntity, {
            id: input.sourceId,
            workspaceId: input.workspaceId,
            kind: "text",
            topic: source.topic,
            tags: [...source.tags],
            visibility: source.visibility,
            title: source.title,
            content: source.content,
            status: "queued",
            progress: 0,
            origin: source.origin,
            sizeBytes,
            createdBy: null,
        })
        const [row] = inserted.identifiers
        if (typeof row?.id !== "string")
            throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
        await this.queue.enqueueIndex({ sourceId: row.id, workspaceId: input.workspaceId }, tx)
        return { id: row.id }
    }

    /** Historical inline jobs already own a source; index that exact workspace-scoped row. */
    async indexExisting(workspaceId: string, sourceId: string, tx: EntityManager): Promise<void> {
        const row = await tx.findOne(KnowledgeSourceEntity, {
            select: { id: true },
            where: { id: sourceId, workspaceId },
        })
        if (row === null) throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
        await this.queue.enqueueIndex({ sourceId: row.id, workspaceId }, tx)
    }
}
