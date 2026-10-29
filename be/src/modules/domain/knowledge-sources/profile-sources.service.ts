import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { KnowledgeSourcesError, KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import type { ProfileSourceInput, ProfileSourceOutcome } from "./knowledge-sources.contracts"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { metaChanges } from "./source-input.policy"

@Injectable()
/**
 * The text documents a workspace configuration run keeps (the cli `seed-workspace profile`): each is found again by its origin
 * and title, and every row change is queued for the normal indexing in the same transaction. The caller has already proven the
 * workspace owner; the knowledge pages keep using KnowledgeSourcesService.
 */
export class ProfileSourcesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly queue: KnowledgeQueue,
    ) {}

    /** Adds a new document, queues again one whose text changed (with its new module, topic and visibility), or leaves it alone. */
    keep(source: ProfileSourceInput): Promise<ProfileSourceOutcome> {
        const { workspaceId } = source
        return this.entityManager.transaction(async (tx) => {
            const found = await tx.findOne(KnowledgeSourceEntity, {
                select: { id: true, content: true },
                where: { workspaceId, origin: source.origin, title: source.title },
                order: { createdAt: "ASC" },
                lock: { mode: "pessimistic_write" },
            })
            if (found === null) {
                const sourceId = await this.insert(tx, source)
                await this.queue.enqueueIndex({ sourceId, workspaceId }, tx)
                return "inserted"
            }
            if (found.content === source.content) return "unchanged"
            await tx.update(
                KnowledgeSourceEntity,
                { id: found.id, workspaceId },
                { status: "queued", progress: 0, error: null, content: source.content, updatedAt: () => "now()" },
            )
            await tx.update(
                KnowledgeSourceEntity,
                { id: found.id, workspaceId },
                metaChanges({
                    title: null,
                    topic: source.topic,
                    tags: null,
                    module: source.module ?? "",
                    visibility: source.visibility,
                }),
            )
            await this.queue.enqueueIndex({ sourceId: found.id, workspaceId }, tx, this.clock.now().getTime())
            return "requeued"
        })
    }

    private async insert(tx: EntityManager, source: ProfileSourceInput): Promise<string> {
        const inserted = await tx.insert(KnowledgeSourceEntity, {
            workspaceId: source.workspaceId,
            module: source.module,
            installationId: null,
            kind: "text",
            topic: source.topic,
            tags: [],
            visibility: source.visibility,
            title: source.title,
            content: source.content,
            status: "queued",
            progress: 0,
            storagePath: null,
            sourceUrl: null,
            origin: source.origin,
            createdBy: source.ownerId,
        })
        const [row] = inserted.identifiers
        if (typeof row?.id !== "string")
            throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
        return row.id
    }
}
