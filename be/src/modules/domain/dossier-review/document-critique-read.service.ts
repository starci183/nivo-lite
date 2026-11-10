import { Injectable } from "@nestjs/common"
import { In, IsNull, Like, type EntityManager } from "typeorm"
import { CUSTOMER_READY_COLUMN, KnowledgeChunksService } from "@modules/domain/knowledge-chunks"
import { DossierSourcesService } from "@modules/domain/knowledge-sources"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import {
    CRITIC_RULE_PREFIX,
    GROUP_OF,
    type CriticAgainst,
    type CriticAnswer,
    type CriticChoice,
    type CriticGroup,
    type CriticKind,
    type CriticTarget,
    type CritiqueState,
    type NotDoneReason,
    type PointState,
} from "./document-critic.contracts"
import { pointStateOf, storedPointOf } from "./document-critic-reconcile.policy"
import { DocumentCriticService } from "./document-critic.service"
import { DossierFindingEntity, SourceCritiqueEntity } from "./persistence/entities"

/** A quote as the page shows it, with the page / slide / sheet its passage sits on when the reader gave one. */
export interface CritiqueQuoteView {
    /** The words, verbatim. */
    readonly text: string
    /** page, slide or sheet, when the reader gave the place. */
    readonly placeKind: string | null
    /** The page or slide number, or the sheet name. */
    readonly placeLabel: string | null
    /** The model-free hash of the passage. */
    readonly chunkHash: string | null
    /** The stored passage, when it is one of this document. */
    readonly passageId: string | null
    /** The document it comes from. */
    readonly sourceTitle: string | null
    /** This document, or another one / the value in use. */
    readonly role: "this" | "other"
    /** The fact it backs, when any. */
    readonly factId: string | null
}

/** One point as the page shows it. */
export interface CritiquePointView {
    /** The point (a dossier_findings row). */
    readonly id: string
    /** The document it is about. */
    readonly sourceId: string | null
    /** The chip the founder reads. */
    readonly group: CriticGroup
    /** The critic kind. */
    readonly kind: CriticKind
    /** high, medium or low; an open high point holds its passages back from customers. */
    readonly severity: string
    /** rule or ai. */
    readonly origin: string
    /** The line the founder reads. */
    readonly line: string
    /** Why NIVO doubts it. */
    readonly why: string
    /** The question to the founder. */
    readonly question: string
    /** The quoted places, this document's first. */
    readonly quotes: ReadonlyArray<CritiqueQuoteView>
    /** What it is compared with. */
    readonly against: CriticAgainst | null
    /** At most two buttons. */
    readonly choices: ReadonlyArray<CriticChoice>
    /** open, answered, skipped or gone. */
    readonly state: PointState
    /** The answer given, when any. */
    readonly answer: CriticAnswer | null
    /** The waiting proposal the answer filed or kept. */
    readonly proposalFactId: string | null
    /** When it was answered or skipped, ISO 8601. */
    readonly decidedAt: string | null
    /** When it was first raised, ISO 8601. */
    readonly firstSeenAt: string
    /** The facts it cites. */
    readonly factIds: ReadonlyArray<string>
    /** Where a typed answer is filed when no fact stands for the point. */
    readonly target: CriticTarget | null
}

/** Where the critique of a document stands. */
export interface CritiqueReviewView {
    /** waiting, running, done or not_done. */
    readonly state: CritiqueState
    /** Why it is not done; null otherwise. */
    readonly reason: NotDoneReason | null
    /** Tries of the model in the last critique. */
    readonly attempts: number
    /** When it last ended, ISO 8601. */
    readonly finishedAt: string | null
    /** True when the founder let customers read this version unreviewed. */
    readonly released: boolean
    /** When, ISO 8601. */
    readonly releasedAt: string | null
}

/** What customer-facing agents may read of a document. */
export interface CritiqueServingView {
    /** withheld, partly or served. */
    readonly state: "withheld" | "partly" | "served"
    /** Passages customers may not read yet. */
    readonly withheldPassages: number
    /** All stored passages of the document. */
    readonly totalPassages: number
}

/** The points of a document by state. */
export interface CritiqueCounts {
    /** Still to see. */
    readonly open: number
    /** Open and high. */
    readonly high: number
    /** Answered by the founder. */
    readonly answered: number
    /** Skipped. */
    readonly skipped: number
    /** No longer in the document. */
    readonly gone: number
}

/** The critique of one document. */
export interface CritiqueView {
    /** The document. */
    readonly sourceId: string
    /** Its title. */
    readonly title: string
    /** Where its critique stands. */
    readonly review: CritiqueReviewView
    /** What customers may read of it. */
    readonly serving: CritiqueServingView
    /** Its points by state. */
    readonly counts: CritiqueCounts
    /** The points in the states asked for, high first. */
    readonly points: ReadonlyArray<CritiquePointView>
}

/** One document in the list of critiques. */
export interface CritiqueSourceView {
    /** The document. */
    readonly sourceId: string
    /** Its title. */
    readonly title: string
    /** Where its critique stands. */
    readonly review: CritiqueReviewView
    /** Open points. */
    readonly open: number
    /** Open high points. */
    readonly high: number
}

const NO_REVIEW: CritiqueReviewView = { state: "waiting", reason: null, attempts: 0, finishedAt: null, released: false, releasedAt: null }

const reviewOf = (row: SourceCritiqueEntity | null): CritiqueReviewView =>
    row === null
        ? NO_REVIEW
        : {
              state: row.state,
              reason: row.reason,
              attempts: row.attempts,
              finishedAt: row.finishedAt?.toISOString() ?? null,
              released: row.releasedAt !== null,
              releasedAt: row.releasedAt?.toISOString() ?? null,
          }

const isHigh = (row: DossierFindingEntity): boolean => row.severity === "high" || row.severity === "critical"

/** The most documents the list reads. */
const SOURCES_MAX = 200

@Injectable()
/** The reads and the recorded decisions of the shop-document critique, for the Second Brain page. It never changes a fact. */
export class DocumentCritiqueReadService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly critic: DocumentCriticService,
        private readonly chunks: KnowledgeChunksService,
        private readonly sources: DossierSourcesService,
    ) {}

    /** The critique of a document with its points in these states; null when the document is not the workspace's. */
    async view(workspaceId: string, sourceId: string, states: ReadonlyArray<PointState>): Promise<CritiqueView | null> {
        const source = await this.sources.sourceOf(workspaceId, sourceId)
        if (source === null) return null
        const row = await this.entityManager.findOne(SourceCritiqueEntity, { where: { workspaceId, sourceId } })
        const rows = await this.critic.pointsOf(workspaceId, sourceId)
        const own = rows.filter((one) => storedPointOf(one).sourceId === sourceId)
        const views = await this.viewsOf(workspaceId, own)
        const count = (state: PointState): number => views.filter((one) => one.state === state).length
        return {
            sourceId,
            title: source.title,
            review: reviewOf(row),
            serving: await this.servingOf(workspaceId, sourceId),
            counts: {
                open: count("open"),
                high: own.filter((one) => isHigh(one) && pointStateOf(one) === "open").length,
                answered: count("answered"),
                skipped: count("skipped"),
                gone: count("gone"),
            },
            points: views
                .filter((one) => states.includes(one.state))
                .sort((a, b) => Number(b.severity === "high") - Number(a.severity === "high") || a.firstSeenAt.localeCompare(b.firstSeenAt)),
        }
    }

    /** Every critiqued document of the workspace with its open and open-high counts, newest critique first. */
    async sourcesOf(workspaceId: string): Promise<ReadonlyArray<CritiqueSourceView>> {
        const rows = await this.entityManager.find(SourceCritiqueEntity, {
            where: { workspaceId },
            order: { requestedAt: "DESC" },
            take: SOURCES_MAX,
        })
        if (rows.length === 0) return []
        const open = await this.entityManager.find(DossierFindingEntity, {
            select: { id: true, params: true, severity: true },
            where: { workspaceId, dossierId: IsNull(), ruleKey: Like(`${CRITIC_RULE_PREFIX}%`), status: In(["open", "confirmed"]) },
            take: 5_000,
        })
        const views = await Promise.all(
            rows.map(async (row) => {
                const source = await this.sources.sourceOf(workspaceId, row.sourceId)
                const mine = open.filter((one) => one.params.sourceId === row.sourceId)
                return source === null
                    ? null
                    : { sourceId: row.sourceId, title: source.title, review: reviewOf(row), open: mine.length, high: mine.filter(isHigh).length }
            }),
        )
        return views.flatMap((one) => (one === null ? [] : [one]))
    }

    /** One point of the workspace, with its row; null when it is not a critic point of this workspace. */
    async point(workspaceId: string, findingId: string): Promise<{ readonly row: DossierFindingEntity; readonly view: CritiquePointView } | null> {
        const row = await this.entityManager.findOne(DossierFindingEntity, { where: { workspaceId, id: findingId, dossierId: IsNull(), ruleKey: Like(`${CRITIC_RULE_PREFIX}%`) } })
        if (row === null) return null
        const [view] = await this.viewsOf(workspaceId, [row])
        return view === undefined ? null : { row, view }
    }

    /** Records the founder's answer on a point (the fact change is made by the caller through the founder-only path) and re-sets the gate. */
    async recordAnswer(
        workspaceId: string,
        findingId: string,
        decision: { readonly answer: CriticAnswer; readonly proposalFactId: string | null; readonly by: string; readonly note: string | null },
    ): Promise<void> {
        const now = this.clock.now()
        const row = await this.entityManager.findOneOrFail(DossierFindingEntity, { where: { workspaceId, id: findingId } })
        await this.entityManager.update(
            DossierFindingEntity,
            { workspaceId, id: findingId, status: In(["open", "confirmed"]) },
            {
                status: "resolved",
                resolution: "manual",
                resolvedAt: now,
                decidedBy: decision.by,
                decidedAt: now,
                decisionNote: decision.note ?? `answer:${decision.answer.kind}`,
                params: { ...row.params, answer: JSON.stringify(decision.answer), proposalFactId: decision.proposalFactId ?? "" },
            },
        )
        await this.regateOf(workspaceId, row)
    }

    /** Skips a point (dismissed, with the reason) and re-sets the gate. */
    async skip(workspaceId: string, findingId: string, by: string, reason: string): Promise<void> {
        const now = this.clock.now()
        const row = await this.entityManager.findOneOrFail(DossierFindingEntity, { where: { workspaceId, id: findingId } })
        await this.entityManager.update(
            DossierFindingEntity,
            { workspaceId, id: findingId, status: In(["open", "confirmed"]) },
            { status: "dismissed", dismissReason: reason, dismissedEvidenceHash: row.evidenceHash, decidedBy: by, decidedAt: now },
        )
        await this.regateOf(workspaceId, row)
    }

    /** The founder lets customers read a document whose critique could not finish (this version only: a new upload ends it). */
    async release(workspaceId: string, sourceId: string, by: string): Promise<CritiqueServingView | null> {
        const moved = await this.entityManager.update(SourceCritiqueEntity, { workspaceId, sourceId }, { releasedBy: by, releasedAt: this.clock.now() })
        if ((moved.affected ?? 0) === 0) return null
        await this.critic.regate(workspaceId, sourceId)
        return this.servingOf(workspaceId, sourceId)
    }

    /** The review state of a document. */
    async reviewOfSource(workspaceId: string, sourceId: string): Promise<CritiqueReviewView> {
        return reviewOf(await this.entityManager.findOne(SourceCritiqueEntity, { where: { workspaceId, sourceId } }))
    }

    private async regateOf(workspaceId: string, row: DossierFindingEntity): Promise<void> {
        const sourceId = storedPointOf(row).sourceId
        if (sourceId !== null) await this.critic.regate(workspaceId, sourceId)
    }

    /** How many passages of a document customers may read now. */
    private async servingOf(workspaceId: string, sourceId: string): Promise<CritiqueServingView> {
        const rows: ReadonlyArray<{ readonly total?: unknown; readonly ready?: unknown }> = await this.entityManager.query(
            `SELECT count(*)::int AS total, count(*) FILTER (WHERE ${CUSTOMER_READY_COLUMN})::int AS ready FROM public.knowledge_chunks WHERE workspace_id = $1 AND source_id = $2`,
            [workspaceId, sourceId],
        )
        const total = Number(rows[0]?.total ?? 0)
        const withheld = total - Number(rows[0]?.ready ?? 0)
        return { state: withheld === 0 ? "served" : withheld === total ? "withheld" : "partly", withheldPassages: withheld, totalPassages: total }
    }

    private async viewsOf(workspaceId: string, rows: ReadonlyArray<DossierFindingEntity>): Promise<ReadonlyArray<CritiquePointView>> {
        const passageIds = rows.flatMap((row) => row.evidence.flatMap((item) => (item.passageId === null ? [] : [item.passageId])))
        const places = await this.chunks.placesOf(workspaceId, [...new Set(passageIds)])
        return rows.flatMap((row): Array<CritiquePointView> => {
            const stored = storedPointOf(row)
            if (stored.kind === null) return []
            return [
                {
                    id: row.id,
                    sourceId: stored.sourceId,
                    group: GROUP_OF[stored.kind],
                    kind: stored.kind,
                    severity: row.severity,
                    origin: row.origin,
                    line: row.title,
                    why: row.detail,
                    question: stored.question,
                    quotes: row.evidence.map((item) => {
                        const place = item.passageId === null ? undefined : places.get(item.passageId)
                        return {
                            text: item.quote ?? "",
                            placeKind: place?.kind ?? null,
                            placeLabel: place?.label ?? null,
                            chunkHash: item.chunkHash ?? null,
                            passageId: item.passageId,
                            sourceTitle: item.sourceTitle,
                            role: item.role === "claim" ? "this" : "other",
                            factId: item.factId,
                        }
                    }),
                    against: stored.against,
                    choices: stored.choices,
                    state: pointStateOf(row),
                    answer: stored.answer,
                    proposalFactId: stored.proposalFactId === "" ? null : stored.proposalFactId,
                    decidedAt: row.decidedAt?.toISOString() ?? null,
                    firstSeenAt: row.firstSeenAt.toISOString(),
                    factIds: [...row.factIds],
                    target: stored.target,
                },
            ]
        })
    }
}
