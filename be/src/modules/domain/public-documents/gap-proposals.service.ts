import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { GapRecord } from "@modules/domain/knowledge-gaps"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectKnowledgeQueue } from "@modules/queues/knowledge"
import type { KnowledgeQueue } from "@modules/queues/knowledge"
import { PublicDocumentEntity } from "./persistence/entities"
import { MAX_TITLE_CHARS } from "./public-documents.contracts"

@Injectable()
/**
 * Starts the look for an internal answer to a customer question the public documents could not answer. The Chatbot has already handed
 * the conversation to a person; this runs apart from it, in a background job with no customer in it. One question gets one proposal,
 * and nothing reaches a customer: the proposal waits in the owner's queue to be approved.
 */
export class GapProposalsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectKnowledgeQueue() private readonly queue: KnowledgeQueue,
    ) {}

    /** Queues the look for the gap, once: a question that already has a proposal, approved or not, is not looked up again. */
    async open(workspaceId: string, gap: GapRecord): Promise<void> {
        const known = await this.entityManager.exists(PublicDocumentEntity, { where: { workspaceId, gapId: gap.id } })
        if (known) return
        await this.entityManager.transaction(async (tx) => {
            const inserted = await tx
                .createQueryBuilder(PublicDocumentEntity, "document")
                .insert()
                .into(PublicDocumentEntity)
                .values({
                    workspaceId,
                    title: gap.question.slice(0, MAX_TITLE_CHARS),
                    kind: "answer",
                    status: "drafting",
                    question: gap.question,
                    gapId: gap.id,
                })
                .orIgnore()
                .returning("id")
                .execute()
            const [identifier] = inserted.identifiers
            if (typeof identifier?.id !== "string") return
            await this.queue.enqueuePublicDraft({ documentId: identifier.id, workspaceId, draftRevision: 0 }, tx)
        })
    }
}
