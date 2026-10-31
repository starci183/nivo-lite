import { Injectable } from "@nestjs/common"
import { ArrayContains, IsNull } from "typeorm"
import type { EntityManager } from "typeorm"
import { DossierSourcesService } from "@modules/domain/knowledge-sources"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { eachInOrder } from "@modules/platform/primitives"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { refOfSource } from "./document-state.policy"
import type { OptionalId, OptionalText, ReviewRunRecord } from "./dossier-review.contracts"
import { DossierReviewError, DossierReviewErrorCode } from "./errors/dossier-review.error"
import { toRunRecord } from "./finding-record.mapper"
import { DossierFindingEntity, DossierReviewRunEntity } from "./persistence/entities"
import { ReviewInputsService } from "./review-inputs.service"

/** Who may ask for a review. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** The most dossiers a deleted document re-checks. */
const GONE_MAX = 500

/** What asked for a run and about what. */
interface RunAsk {
    readonly workspaceId: string
    readonly dossierId: string | null
    readonly trigger: "document" | "document_gone" | "request"
    readonly triggerRef: string | null
    readonly requestedBy: string | null
}

@Injectable()
/** Asks for review runs: one queued run per dossier (or per workspace) at a time, written with its queue job in one transaction. */
export class DossierReviewRunsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectIds() private readonly ids: Ids,
        private readonly members: WorkspaceMembersService,
        private readonly inputs: ReviewInputsService,
        private readonly sources: DossierSourcesService,
        private readonly queue: KnowledgeQueue,
    ) {}

    /** The facts of a document were read (or given up): its dossier is reviewed; a document that names no dossier asks nothing. */
    async requestForSource(workspaceId: string, sourceId: string): Promise<void> {
        const source = await this.sources.sourceOf(workspaceId, sourceId)
        if (source === null) return
        const ref = refOfSource(source)
        const dossier = (await this.inputs.all(workspaceId)).find(
            (item) => item.ref === ref && item.category.normalize("NFC") === source.topic?.normalize("NFC"),
        )
        if (dossier === undefined) return
        await this.enqueue({
            workspaceId,
            dossierId: dossier.id,
            trigger: "document",
            triggerRef: sourceId,
            requestedBy: null,
        })
    }

    /** A document was deleted: every dossier with a finding citing it is reviewed again, and the dossier its title named. */
    async requestForGoneSource(
        workspaceId: string,
        sourceId: string,
        topic: OptionalText,
        title: string,
    ): Promise<void> {
        const cited = await this.entityManager.find(DossierFindingEntity, {
            select: { id: true, dossierId: true },
            where: { workspaceId, sourceIds: ArrayContains([sourceId]) },
            take: GONE_MAX,
        })
        const ref = refOfSource({ tags: [], title })
        const named = (await this.inputs.all(workspaceId)).filter(
            (dossier) =>
                dossier.ref === ref && (topic === null || dossier.category.normalize("NFC") === topic.normalize("NFC")),
        )
        const ids = new Set([
            ...cited.flatMap((row) => (row.dossierId === null ? [] : [row.dossierId])),
            ...named.map((dossier) => dossier.id),
        ])
        await eachInOrder(
            [...ids].sort((a, b) => a.localeCompare(b)),
            async (dossierId) => {
                await this.enqueue({
                    workspaceId,
                    dossierId,
                    trigger: "document_gone",
                    triggerRef: sourceId,
                    requestedBy: null,
                })
            },
        )
    }

    /** An owner or manager asks for a review of one dossier, or of the whole set (null); answers the run that is queued. */
    async request(userId: string, workspaceId: string, dossierId: OptionalId): Promise<ReviewRunRecord> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const dossiers = await this.inputs.all(workspaceId)
        const known = dossierId === null ? dossiers.length > 0 : dossiers.some((dossier) => dossier.id === dossierId)
        if (!known) throw new DossierReviewError({ code: DossierReviewErrorCode.NothingToReview })
        const memberId = await this.members.idOf(userId, workspaceId)
        return toRunRecord(
            await this.enqueue({ workspaceId, dossierId, trigger: "request", triggerRef: null, requestedBy: memberId }),
        )
    }

    /**
     * Writes the run and its job in one transaction. A request while a run of the same dossier (or of the workspace) is queued writes
     * nothing and answers the queued one; a dossier request while a workspace run is queued is covered by it.
     */
    private enqueue(ask: RunAsk): Promise<DossierReviewRunEntity> {
        return this.entityManager.transaction(async (tx) => {
            const queuedWhole = await tx.findOne(DossierReviewRunEntity, {
                where: { workspaceId: ask.workspaceId, status: "queued", dossierId: IsNull() },
            })
            if (queuedWhole !== null && ask.dossierId !== null) return queuedWhole
            const id = this.ids.next()
            await tx
                .createQueryBuilder(DossierReviewRunEntity, "r")
                .insert()
                .values({
                    id,
                    workspaceId: ask.workspaceId,
                    scope: ask.dossierId === null ? "workspace" : "dossier",
                    dossierId: ask.dossierId,
                    trigger: ask.trigger,
                    triggerRef: ask.triggerRef,
                    status: "queued",
                    requestedBy: ask.requestedBy,
                })
                .orIgnore()
                .execute()
            const queued = await tx.findOneOrFail(DossierReviewRunEntity, {
                where: {
                    workspaceId: ask.workspaceId,
                    status: "queued",
                    dossierId: ask.dossierId === null ? IsNull() : ask.dossierId,
                },
            })
            if (queued.id === id) await this.queue.enqueueDossierReview({ runId: id, workspaceId: ask.workspaceId }, tx)
            return queued
        })
    }
}
