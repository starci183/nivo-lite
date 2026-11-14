import { Injectable, type OnModuleInit } from "@nestjs/common"
import { ArrayOverlap, In, IsNull, Like, type EntityManager } from "typeorm"
import { BrainFactsReadService, BrainFactsService, type FactsChangedHook } from "@modules/domain/brain-facts"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { CRITIC_RULE_PREFIX } from "./document-critic.contracts"
import { DocumentCriticService } from "./document-critic.service"
import { DossierReviewLogEvent } from "./dossier-review.log-events"
import { DossierFindingEntity } from "./persistence/entities"

/** The note a point closed by the founder's decision on its fact keeps. */
export const DECIDED_NOTE = "decided on the fact"

/**
 * The heads of the decision note the settle of a document writes when IT puts a truth in force (`direct:<document>`, `updated:`): no
 * decision of the founder. Such a truth closes no point: a line may state two truths, and the clean one applied from another
 * document would otherwise close the point that holds the doubted one, which then goes in force unasked (D-R-1).
 */
const SETTLE_NOTE_HEADS = ["direct:", "updated:"] as const

/** True when a truth in force was decided by a person (an apply, a choice, an answer), not by the settle of a document. */
const decidedByPerson = (note: string | null): boolean => !SETTLE_NOTE_HEADS.some((head) => note?.startsWith(head) === true)

/** The most points one announcement closes (a bulk apply announces many facts at once). */
const POINTS_MAX = 500

@Injectable()
/**
 * D-BR-13: deciding a fact closes the critic points it settles. When the founder puts a value in force (apply, choose, a split, the
 * policy tab), every OPEN point of the document critic that names that fact and was raised before the decision is resolved
 * (`manual`, note `decided on the fact`), and the trust gate of its document is set again, so its passages are no longer held for a
 * question the founder already answered on the graph. A point whose named facts were only turned down ON THE GRAPH stays open: the
 * document still says what was refused (the brain itself turns a duplicate down), and the point says so until it is answered or the
 * document changes. A truth the SETTLE of a document put in force by itself is no decision of the founder and closes nothing: the
 * point still asks.
 *
 * The founder's ANSWER to a point that turns a truth down is his decision about that truth (`turnedDown`): every other open point
 * that names it, and names no truth that still waits, is a question about nothing and closes with it.
 */
export class CritiqueDecisionsService implements FactsChangedHook, OnModuleInit {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly facts: BrainFactsService,
        private readonly reads: BrainFactsReadService,
        private readonly critic: DocumentCriticService,
    ) {}

    /** Listens to the facts store's announcements. */
    onModuleInit(): void {
        this.facts.whenChanged(this)
    }

    /** What is in force changed: the open points that name a fact now in force by a later decision are closed. Never throws. */
    async factsChanged(workspaceId: string, changedIds: ReadonlyArray<string>): Promise<void> {
        if (changedIds.length === 0) return
        try {
            const points = await this.openNaming(workspaceId, changedIds)
            if (points.length === 0) return
            const decided = new Map(
                (await this.reads.byIds(workspaceId, changedIds))
                    .filter(
                        (fact) =>
                            (fact.status === "active" || fact.status === "scheduled") && fact.decidedAt !== null && decidedByPerson(fact.decisionNote),
                    )
                    .map((fact) => [fact.id, Date.parse(fact.decidedAt ?? "")]),
            )
            const settled = points.filter((point) =>
                point.factIds.some((id) => (decided.get(id) ?? Number.NEGATIVE_INFINITY) >= point.firstSeenAt.getTime()),
            )
            await this.close(workspaceId, settled)
        } catch (cause) {
            this.logger.error(DossierReviewLogEvent.CritiqueFailed, cause, { workspaceId })
        }
    }

    /**
     * The founder turned these truths down by a decision of his own (his answer to a point, his correction of a waiting truth): the
     * OTHER open points that name one of them and name no truth that still waits close as decided. A point that still names a waiting
     * truth keeps asking about it. By ids and states only. Never throws.
     */
    async turnedDown(workspaceId: string, rejectedIds: ReadonlyArray<string>): Promise<void> {
        if (rejectedIds.length === 0) return
        try {
            const points = await this.openNaming(workspaceId, rejectedIds)
            if (points.length === 0) return
            const named = [...new Set(points.flatMap((point) => point.factIds))]
            const waiting = new Set(
                (await this.reads.byIds(workspaceId, named)).filter((fact) => fact.status === "proposed").map((fact) => fact.id),
            )
            await this.close(
                workspaceId,
                points.filter((point) => !point.factIds.some((id) => waiting.has(id))),
            )
        } catch (cause) {
            this.logger.error(DossierReviewLogEvent.CritiqueFailed, cause, { workspaceId })
        }
    }

    /** The open points of the document critic that name one of these facts. */
    private openNaming(workspaceId: string, factIds: ReadonlyArray<string>): Promise<ReadonlyArray<DossierFindingEntity>> {
        return this.entityManager.find(DossierFindingEntity, {
            select: { id: true, factIds: true, firstSeenAt: true, sourceIds: true },
            where: {
                workspaceId,
                dossierId: IsNull(),
                ruleKey: Like(`${CRITIC_RULE_PREFIX}%`),
                status: In(["open", "confirmed"]),
                factIds: ArrayOverlap([...factIds]),
            },
            take: POINTS_MAX,
        })
    }

    /** Closes points as decided on their facts; their documents' gates are set again and the truths that waited on them settled. */
    private async close(workspaceId: string, settled: ReadonlyArray<DossierFindingEntity>): Promise<void> {
        if (settled.length === 0) return
        const now = this.clock.now()
        await this.entityManager.update(
            DossierFindingEntity,
            { workspaceId, id: In(settled.map((point) => point.id)), status: In(["open", "confirmed"]) },
            { status: "resolved", resolution: "manual", resolvedAt: now, decisionNote: DECIDED_NOTE, lastSeenAt: now },
        )
        const sources = [...new Set(settled.flatMap((point) => point.sourceIds))]
        // The passages those points held are free again: the customer gate is set, and the truths that waited on them are settled.
        await eachInOrder(sources, async (sourceId) => {
            await this.critic.regate(workspaceId, sourceId)
            await this.critic.changed(workspaceId, sourceId)
        })
    }
}
