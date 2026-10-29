import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import type { IndexedSource, InboxClaim } from "./brain.contracts"

@Injectable()
/**
 * The `brain` reactor of `knowledge_source_indexed`. Reading the facts of a source is heavy work and stays a job of the knowledge
 * queue; this service only starts it, in the transaction that claims the delivery, so a redelivery queues nothing twice.
 */
export class IndexedSourcesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectInbox() private readonly inbox: Inbox,
        private readonly queue: KnowledgeQueue,
    ) {}

    /** Queues the facts job of an indexed source; `indexedAt` keys the one reading of this indexing. */
    queueFacts(indexed: IndexedSource, claim: InboxClaim): Promise<void> {
        return this.entityManager.transaction(async (tx) => {
            if (!(await this.inbox.claim(claim.consumer, claim.dedupeKey, tx))) return
            await this.queue.enqueueFacts(
                { sourceId: indexed.sourceId, workspaceId: indexed.workspaceId },
                tx,
                indexed.indexedAt,
            )
        })
    }
}
