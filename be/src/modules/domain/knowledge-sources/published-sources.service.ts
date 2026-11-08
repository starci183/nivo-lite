import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { unwrapOutcome } from "@modules/platform/primitives"
import { InjectKnowledgeQueue, type KnowledgeQueue } from "@modules/queues/knowledge"
import { KnowledgeSourcesError, KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { KnowledgeProgressService } from "./knowledge-progress.service"
import {
    PUBLIC_DOCUMENT_ORIGIN,
    type PublishedSourceInput,
    type SourceRef,
    type SourceStatus,
} from "./knowledge-sources.contracts"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { normalizeSource, requeued, type NormalizedSource } from "./source-input.policy"
import { SourceQuotaService } from "./source-quota.service"

/** The statuses of a source no worker is on: only such a source is read again. */
const IDLE_STATUSES: Array<SourceStatus> = ["pending", "ready", "failed", "blocked_credits"]

@Injectable()
/**
 * The one door through which a document becomes public. A public document an owner approved is written here as its own source, with
 * its own text; no internal document is ever changed to public. The caller (the public-documents capability) proves the approver.
 */
export class PublishedSourcesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectKnowledgeQueue() private readonly queue: KnowledgeQueue,
        private readonly quota: SourceQuotaService,
        private readonly progress: KnowledgeProgressService,
    ) {}

    /** Writes the approved text as a new public source with the id of its public document, and queues its indexing; the row and the job commit together. */
    async publish(
        workspaceId: string,
        approverId: string,
        sourceId: string,
        input: PublishedSourceInput,
        manager?: EntityManager,
    ): Promise<SourceRef> {
        const source = this.normalized(workspaceId, input)
        const sizeBytes = await this.quota.measure(source)
        const write = async (tx: EntityManager): Promise<SourceRef> => {
            await this.quota.admit(tx, workspaceId, sizeBytes)
            const inserted = await tx.insert(KnowledgeSourceEntity, {
                id: sourceId,
                workspaceId,
                module: null,
                installationId: null,
                kind: "text",
                topic: source.topic,
                tags: [...source.tags],
                visibility: "public",
                title: source.title,
                content: source.content,
                status: "queued",
                progress: 0,
                storagePath: null,
                sourceUrl: null,
                origin: PUBLIC_DOCUMENT_ORIGIN,
                sizeBytes,
                createdBy: approverId,
            })
            const id = this.idOf(inserted.identifiers)
            await this.queue.enqueueIndex({ sourceId: id, workspaceId }, tx)
            return { id }
        }
        const ref = manager === undefined ? await this.entityManager.transaction(write) : await write(manager)
        if (manager === undefined) await this.announce(workspaceId, ref.id)
        return ref
    }

    /** Replaces the text of a public document's source with the newly approved text and queues it to be read again. */
    async replace(
        workspaceId: string,
        sourceId: string,
        input: PublishedSourceInput,
        manager?: EntityManager,
    ): Promise<SourceRef> {
        const source = this.normalized(workspaceId, input)
        const sizeBytes = await this.quota.measure(source)
        const write = async (tx: EntityManager): Promise<void> => {
            const changed = await tx.update(
                KnowledgeSourceEntity,
                { id: sourceId, workspaceId, origin: PUBLIC_DOCUMENT_ORIGIN, status: In(IDLE_STATUSES) },
                requeued({ title: source.title, content: source.content, sizeBytes }),
            )
            if ((changed.affected ?? 0) === 0) await this.refuseNotReplaceable(tx, workspaceId, sourceId)
            await this.queue.enqueueIndex({ sourceId, workspaceId }, tx, this.clock.now().getTime())
        }
        if (manager === undefined) await this.entityManager.transaction(write)
        else await write(manager)
        if (manager === undefined) await this.announce(workspaceId, sourceId)
        return { id: sourceId }
    }

    /** Takes the public source down with its passages: customers read nothing of it from now on. A source already gone is no error. */
    async withdraw(workspaceId: string, sourceId: string, manager: EntityManager = this.entityManager): Promise<void> {
        await manager.delete(KnowledgeSourceEntity, {
            id: sourceId,
            workspaceId,
            origin: PUBLIC_DOCUMENT_ORIGIN,
        })
    }

    /** Announces the committed source after the caller's approval transaction has finished. */
    announce(workspaceId: string, sourceId: string): Promise<void> {
        return this.progress.announce(workspaceId, sourceId)
    }

    /** The id the insert answered; a write that answered none is a source that is not there. */
    private idOf(identifiers: ReadonlyArray<Record<string, unknown>>): string {
        const [identifier] = identifiers
        if (typeof identifier?.id !== "string") {
            throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
        }
        return identifier.id
    }

    /** The text checked as a source: title and content present, not too long. */
    private normalized(workspaceId: string, input: PublishedSourceInput): NormalizedSource {
        return unwrapOutcome(
            normalizeSource(workspaceId, {
                kind: "text",
                title: input.title,
                content: input.content,
                origin: PUBLIC_DOCUMENT_ORIGIN,
            }),
            KnowledgeSourcesError,
        )
    }

    /** Why nothing was replaced: the source is gone (not found) or a worker is on it (try again). */
    private async refuseNotReplaceable(tx: EntityManager, workspaceId: string, sourceId: string): Promise<never> {
        const found = await tx.findOne(KnowledgeSourceEntity, {
            select: { id: true },
            where: { id: sourceId, workspaceId, origin: PUBLIC_DOCUMENT_ORIGIN },
        })
        throw new KnowledgeSourcesError({
            code: found === null ? KnowledgeSourcesErrorCode.SourceNotFound : KnowledgeSourcesErrorCode.PublishBusy,
        })
    }
}
