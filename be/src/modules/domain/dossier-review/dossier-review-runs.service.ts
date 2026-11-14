import { Injectable } from "@nestjs/common"
import { IsNull, type EntityManager } from "typeorm"
import { KnowledgeSourcesReadService, SourceCriticStageService } from "@modules/domain/knowledge-sources"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectIds, type Ids } from "@modules/platform/ids"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { DocumentCriticService, type CritiqueRequest } from "./document-critic.service"
import { DossierReviewRunEntity } from "./persistence/entities"

/** What asked for a run: a document whose facts were read, or a follow-up of critiques still waiting (no document). */
interface RunAsk {
    readonly workspaceId: string
    readonly triggerRef: string | null
}

@Injectable()
/**
 * Asks for the runs that carry the shop-document critic: one queued run per workspace at a time, written with its queue job in one
 * transaction. A run reads no dossier: it runs the critiques that wait (`DossierReviewRunnerService`).
 */
export class DossierReviewRunsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectIds() private readonly ids: Ids,
        private readonly sources: KnowledgeSourcesReadService,
        private readonly queue: KnowledgeQueue,
        private readonly critic: SourceCriticStageService,
        private readonly documentCritic: DocumentCriticService,
    ) {}

    /**
     * The facts of a document were read (or given up): its critique waits and a run of the workspace is queued. `{ resume: true }` (the
     * upkeep tick going on with a critique that stopped) keeps the critique's count of runs without progress, and queues NOTHING when
     * the critique does not wait again (given up, done, or still running): a resume is never a new request, and a tick never queues a
     * run for a critique that will not run.
     */
    async requestForSource(workspaceId: string, sourceId: string, how: CritiqueRequest = {}): Promise<void> {
        if ((await this.sources.briefsOf(workspaceId, [sourceId])).length === 0) return
        // The shop-document critic waits for this run (written before the run is queued, so the run always sees it).
        const waits = await this.documentCritic.request(workspaceId, sourceId, how)
        if (!waits && how.resume === true) return
        await this.enqueue({ workspaceId, triggerRef: sourceId })
        await this.critic.enter(workspaceId, sourceId)
    }

    /**
     * A run ended with shop-document critiques still waiting (more than one run carries out): a follow-up run of the workspace is
     * queued, so no critique waits for a request that may never come (the batch of a run is a job bound, never a quota). A run already
     * queued covers it.
     */
    async continueCritiques(workspaceId: string): Promise<void> {
        await this.enqueue({ workspaceId, triggerRef: null })
    }

    /** A document was deleted: its critique and its open points go with it. */
    async requestForGoneSource(workspaceId: string, sourceId: string): Promise<void> {
        await this.documentCritic.forget(workspaceId, sourceId)
    }

    /** Writes the run and its job in one transaction. A request while a run of the workspace is queued writes nothing and answers the queued one. */
    private enqueue(ask: RunAsk): Promise<DossierReviewRunEntity> {
        return this.entityManager.transaction(async (tx) => {
            const id = this.ids.next()
            await tx
                .createQueryBuilder(DossierReviewRunEntity, "r")
                .insert()
                .values({
                    id,
                    workspaceId: ask.workspaceId,
                    scope: "workspace",
                    dossierId: null,
                    trigger: "document",
                    triggerRef: ask.triggerRef,
                    status: "queued",
                    requestedBy: null,
                })
                .orIgnore()
                .execute()
            const queued = await tx.findOneOrFail(DossierReviewRunEntity, {
                where: { workspaceId: ask.workspaceId, status: "queued", dossierId: IsNull() },
            })
            if (queued.id === id) await this.queue.enqueueDossierReview({ runId: id, workspaceId: ask.workspaceId }, tx)
            return queued
        })
    }
}
