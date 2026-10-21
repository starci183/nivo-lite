import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { KnowledgeSourcesError, KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import type { ProfileSourceInput, ProfileSourceOutcome } from "./knowledge-sources.contracts"
import type { ProfileSourceRow, SourceIdRow } from "./persistence/knowledge-sources.rows"
import { INSERT_SOURCE, REQUEUE_SOURCE, UPDATE_SOURCE_META } from "./persistence/knowledge-sources.sql"
import { FIND_PROFILE_SOURCE } from "./persistence/profile-sources.sql"

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
            const [found] = await tx.query<Array<ProfileSourceRow>>(FIND_PROFILE_SOURCE, [
                workspaceId,
                source.origin,
                source.title,
            ])
            if (found === undefined) {
                const sourceId = await this.insert(tx, source)
                await this.queue.enqueueIndex({ sourceId, workspaceId }, tx)
                return "inserted"
            }
            if (found.content === source.content) return "unchanged"
            await tx.query(REQUEUE_SOURCE, [found.id, workspaceId, source.content])
            await tx.query(UPDATE_SOURCE_META, [
                found.id,
                workspaceId,
                null,
                source.topic,
                null,
                source.module ?? "",
                source.visibility,
            ])
            await this.queue.enqueueIndex({ sourceId: found.id, workspaceId }, tx, this.clock.now().getTime())
            return "requeued"
        })
    }

    private async insert(tx: EntityManager, source: ProfileSourceInput): Promise<string> {
        const [row] = await tx.query<Array<SourceIdRow>>(INSERT_SOURCE, [
            source.workspaceId,
            source.module,
            null,
            "text",
            source.topic,
            [],
            source.visibility,
            source.title,
            source.content,
            null,
            null,
            source.origin,
            source.ownerId,
        ])
        if (row === undefined) throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
        return row.id
    }
}
