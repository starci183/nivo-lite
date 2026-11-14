import { Injectable, Optional } from "@nestjs/common"
import { ArrayContains, ArrayOverlap, In, IsNull, LessThan, Like, type EntityManager } from "typeorm"
import { BrainExtractionsService } from "@modules/domain/brain-extractions"
import { BrainFactsReadService, type FactRecord } from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import {
    CUSTOMER_READY_COLUMN,
    customerReadyOf,
    KnowledgeChunksService,
    passageTextHashOf,
} from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { VectorSyncService } from "@modules/domain/vector-sync"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger, type Logger, withWorkScope } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import {
    CRITIC_CAPS,
    CRITIC_RULE_PREFIX,
    contradictionPairOf,
    type CriticCandidate,
    type CriticFact,
    type CriticPassage,
    type CriticPoint,
    type CritiqueInput,
    type CritiqueRunEnd,
    type OptionalCritiqueInput,
    type NotDoneReason,
    isGivenUp,
    runsAfter,
    takesAnotherTurn,
} from "./document-critic.contracts"
import { buildCritique, guardCritique, narrowerWindow, type BuiltCritique } from "./document-critic-model.policy"
import {
    InjectDocumentCriticModel,
    InjectShopTruthCandidates,
    type CritiqueAnswer,
    type CritiqueFailure,
    type DocumentCriticModel,
    type ShopTruthCandidates,
    type TruthCandidate,
} from "./document-critic.port"
import {
    GONE_NOTES,
    criticFingerprintOf,
    heldHashes,
    holdingPoint,
    newPointRows,
    reconcileCritique,
} from "./document-critic-reconcile.policy"
import { ruleCritique } from "./document-critic-rules.policy"
import { namedTruths } from "./document-critic-text.policy"
import { CritiqueScopeService } from "./critique-scope.service"
import { truthGateOf, type CritiqueChangedHook, type CritiqueTruthGate } from "./critique-truth-gate.policy"
import { DossierReviewLogEvent } from "./dossier-review.log-events"
import { DossierFindingEntity, SourceCritiqueEntity } from "./persistence/entities"

/** How long a running critique may stay silent before a new request takes it back. */
const STALE_RUNNING_MS = 15 * 60_000

/** The most facts of one document the critic reads (the facts reads' own list bound); each call takes the facts of its passages. */
const FACTS_MAX = 2000

/** The work kind every model call of a document's critique is booked under. */
const CRITIQUE_WORK = "document_critique"

/**
 * How a critique is asked for. A NEW request (a reading ended, a founder's answer, a person's "read again") starts its count of runs
 * without progress again; a RESUME (the upkeep tick going on after credits, the bound of calls or the model stopped it) keeps that
 * count and moves only a critique that is not given up (`CRITIC_CAPS.runs`).
 */
export interface CritiqueRequest {
    /** True for a resume by the upkeep tick; absent or false for a new request. */
    readonly resume?: boolean
}

/** What the run count of a critique reads of its row before a run, to tell afterwards whether the run moved it on. */
interface RunStart {
    /** Runs in a row without progress before this one. */
    readonly attempts: number
    /** Passages reviewed before it. */
    readonly reviewed: number
}

/** How the passages of one run ended, as its count of runs reads them. */
interface RunOutcome {
    /** Why the critique is not done, or null when it is. */
    readonly reason: NotDoneReason | null
    /** True when a passage was newly reviewed (the run's only progress). */
    readonly progressed: boolean
    /** Passages still waiting for review. */
    readonly waiting: number
}

/** What a run's row is ended with. */
interface CountedEnd {
    /** `waiting` for a slice that takes another turn. */
    readonly state: "done" | "not_done" | "waiting"
    /** Why it is not done; null when done or waiting. */
    readonly reason: NotDoneReason | null
    /** Its runs in a row without progress (`brain_source_critiques.attempts`). */
    readonly attempts: number
}

/** What one critique did. */
export interface CritiqueOutcome {
    /** Where it ended: `waiting` when it ended a slice of its work with progress and waits again, behind the workspace's others. */
    readonly state: "done" | "not_done" | "waiting" | "skipped"
    /** Why it is not done. */
    readonly reason: NotDoneReason | null
    /** Model calls made. */
    readonly calls: number
    /** Points found now (rules and model). */
    readonly found: number
}

const SKIPPED: CritiqueOutcome = { state: "skipped", reason: null, calls: 0, found: 0 }

/** How the model part of one critique went. */
interface ModelPart {
    readonly answer: CritiqueAnswer | null
    /** The bundle the answer is about: the call's own, or a narrower one when an answer over the whole window was cut. */
    readonly built: BuiltCritique
    readonly calls: number
    readonly tries: number
    readonly reason: NotDoneReason | null
}

/** What one try of a model call sends: its bundle, and what the model is told about the try before it. */
interface TryPlan {
    readonly built: BuiltCritique
    readonly after: "unreadable" | undefined
}

/** What the tries of one model call read: the call's bundle rebuilt over a narrower window, or null when it cannot be narrowed. */
type Narrower = (built: BuiltCritique) => BuiltCritique | null

/** What the model part of one critique did over its successive calls. */
interface CritiqueRun {
    /** Every passage hash reviewed so far (the earlier ones and those the calls read). */
    readonly reviewed: ReadonlySet<string>
    /** Model calls made. */
    readonly calls: number
    /** Tries of the last call. */
    readonly tries: number
    /** Prompt tokens of the answers. */
    readonly promptTokens: number
    /** Model points kept. */
    readonly found: number
    /** Why the critique is not done, or null when every changed passage was reviewed. */
    readonly reason: NotDoneReason | null
}

const documentEvidenceOf = (fact: FactRecord, sourceId: string) =>
    fact.evidence.find((item) => item.kind === "document" && item.ref === sourceId) ?? null

const titleOf = (fact: FactRecord): string | null =>
    fact.evidence.find((item) => item.kind === "document")?.title ??
    fact.evidence.find((item) => item.kind === "document")?.label ??
    null

const criticFactOf = (fact: FactRecord, sourceId: string | null): CriticFact => {
    const own = sourceId === null ? null : documentEvidenceOf(fact, sourceId)
    const any = own ?? fact.evidence.find((item) => item.quote !== undefined) ?? null
    return {
        id: fact.id,
        subjectLabel: fact.subjectLabel,
        subjectKey: fact.subjectKey,
        attributeLabel: fact.attributeLabel,
        attribute: fact.attribute,
        value: fact.value,
        unit: fact.unit,
        status: fact.status,
        quote: any?.quote ?? null,
        chunkHash: any?.chunkHash ?? null,
        installationId: fact.installationId,
        validFrom: fact.validFrom,
        validTo: fact.validTo,
        scope: fact.scope,
    }
}

/** A critique that stopped and may go on (`DocumentCriticService.stopped`). */
export interface StoppedCritique {
    /** Its workspace. */
    readonly workspaceId: string
    /** Its document. */
    readonly sourceId: string
}

@Injectable()
/**
 * The critic of a SHOP document (owner 2026-11-12: documents are entered by the business's own people and are TRUSTED). It runs
 * inside the review job that follows every facts reading and raises only two things:
 * - CONTRADICTIONS between data, deterministic (`ruleCritique`: one document giving one key two values, a value against the truth in
 *   force or against a value waiting from another document, on the same key or linked by the same-fact judge): ONE point per pair
 *   of truths, naming both, with the two values to pick from;
 * - text ADDRESSED TO AN AI, a security flag, from the passage critic model over the passages no finished critique read (the whole
 *   document on the first upload, only the changed passages later): one call reads at most 16,000 characters / 120 passages and
 *   calls again for the rest, each call with three tries at most, bounded by `callsPerCritique` per run and `CRITIC_CAPS.runs` runs
 *   without progress; a run's progress is the passages it newly reviewed. Any other kind the model gives is dropped.
 * It never changes a fact and never judges whether a line is right. Its points live in `dossier_findings` (no dossier, rule key
 * `shop.<kind>`). The customer gate (`regate`) serves a passage once the security read reviewed it and no open HOLDING point
 * (`holdingPoint`) quotes it; the truths work reads the same holding points (`truthGateOf`) and is told when they change
 * (`changed`). No truth waits for the critique itself: its state and its reviewed passages gate nothing on the truths side.
 */
export class DocumentCriticService {
    private readonly changeHooks: Array<CritiqueChangedHook> = []

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectDocumentCriticModel() private readonly model: DocumentCriticModel,
        @InjectShopTruthCandidates() private readonly truths: ShopTruthCandidates,
        private readonly chunks: KnowledgeChunksService,
        private readonly reads: BrainFactsReadService,
        private readonly extractions: BrainExtractionsService,
        private readonly sources: KnowledgeSourcesReadService,
        private readonly usage: UsageMeterService,
        private readonly scope: CritiqueScopeService,
        @Optional() private readonly vectorSync?: VectorSyncService,
    ) {}

    /** Registers who is told when the critic's verdict on a document changes (the truths work, at module init). */
    whenChanged(hook: CritiqueChangedHook): void {
        if (!this.changeHooks.includes(hook)) this.changeHooks.push(hook)
    }

    /**
     * The critic's verdict on a document changed: every listener is told, one after the other. A listener that fails is logged and never
     * fails the critique or the founder's answer (the upkeep tick settles the document later).
     */
    async changed(workspaceId: string, sourceId: string): Promise<void> {
        await eachInOrder(this.changeHooks, async (hook) => {
            try {
                await hook.critiqued(workspaceId, sourceId)
            } catch (cause) {
                this.logger.error(DossierReviewLogEvent.CritiqueFailed, cause, { sourceId })
            }
        })
    }

    /**
     * THE TRUTH GATE of a document version: the open points with the truths they name and whether each HOLDS (`holdingPoint`: only a
     * contradiction raised by the rules or text addressed to an AI raised by the model), the passages held whole, and what the
     * founder's answers decided, per truth. It reads the same holding points as `regate`, so what customers may be served and what
     * waits for the founder are decided from the same rows; the founder's release never widens it. The open holding points of OTHER
     * documents that name a waiting truth of this one hold it here too (a contradiction is raised once and names both truths).
     */
    async truthGateOf(workspaceId: string, sourceId: string): Promise<CritiqueTruthGate> {
        const row = await this.entityManager.findOne(SourceCritiqueEntity, { where: { workspaceId, sourceId } })
        if (row === null) return truthGateOf(null, [])
        const points = (await this.pointsOf(workspaceId, sourceId)).filter(
            (point) => point.params.sourceId === sourceId,
        )
        const waiting = await this.reads.ofSources(workspaceId, [sourceId], ["proposed"], FACTS_MAX)
        const foreign = (await this.otherPointsNaming(workspaceId, sourceId, waiting.map((fact) => fact.id))).filter((point) =>
            holdingPoint(point),
        )
        return truthGateOf(row, points, foreign)
    }

    /** The open critic points of OTHER documents that name one of these truths (by ids only). */
    private async otherPointsNaming(
        workspaceId: string,
        sourceId: string,
        ids: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<DossierFindingEntity>> {
        if (ids.length === 0) return []
        const found = await this.entityManager.find(DossierFindingEntity, {
            where: {
                workspaceId,
                dossierId: IsNull(),
                ruleKey: Like(`${CRITIC_RULE_PREFIX}%`),
                status: In(["open", "confirmed"]),
                factIds: ArrayOverlap([...ids]),
            },
            take: 2_000,
        })
        return found.filter((point) => point.params.sourceId !== sourceId)
    }

    /**
     * The facts of a document were read (or given up on): its critique waits for the review run; a founder's earlier release ends. The
     * row then counts the passages that wait for review. `{ resume: true }` (the upkeep tick) keeps the count of runs without progress
     * and moves only a critique that may go on (`resume`). Answers whether the critique now waits (or will, after its running one).
     */
    async request(workspaceId: string, sourceId: string, how: CritiqueRequest = {}): Promise<boolean> {
        if (how.resume !== true) await this.ask(workspaceId, sourceId)
        else if (!(await this.resume(workspaceId, sourceId))) return false
        await this.recount(workspaceId, sourceId)
        return true
    }

    /**
     * True when the critique of a document is GIVEN UP (`isGivenUp`: not done after `CRITIC_CAPS.runs` runs in a row without progress):
     * nothing asks for it again by itself; its unreviewed passages stay withheld from customers. False when the document has no
     * critique.
     */
    async givenUp(workspaceId: string, sourceId: string): Promise<boolean> {
        const row = await this.entityManager.findOne(SourceCritiqueEntity, {
            select: { id: true, state: true, attempts: true },
            where: { workspaceId, sourceId },
        })
        return row !== null && isGivenUp(row)
    }

    /**
     * The critiques that STOPPED and may go on (the upkeep tick resumes them: no reading waits for a critique any more, so nothing
     * else would): not done for credits, the bound of calls or the model, not given up; and the ones whose worker went silent. The
     * longest-stopped first, at most `limit`. Ids and states only.
     */
    async stopped(limit: number): Promise<ReadonlyArray<StoppedCritique>> {
        const counts = Array.from({ length: CRITIC_CAPS.runs }, (_, count) => count)
        const silentBefore = new Date(this.clock.now().getTime() - STALE_RUNNING_MS)
        const rows = await this.entityManager.find(SourceCritiqueEntity, {
            select: { id: true, workspaceId: true, sourceId: true },
            where: [
                { state: "not_done", reason: In(["credits", "budget", "model"]), attempts: In(counts) },
                { state: "running", attempts: In(counts), startedAt: LessThan(silentBefore) },
            ],
            order: { finishedAt: "ASC" },
            take: limit,
        })
        return rows.map((row) => ({ workspaceId: row.workspaceId, sourceId: row.sourceId }))
    }

    /** Whether a critique of the workspace still waits for a run (the run that ends queues a follow-up one). */
    hasWaiting(workspaceId: string): Promise<boolean> {
        return this.entityManager.exists(SourceCritiqueEntity, { where: { workspaceId, state: "waiting" } })
    }

    /**
     * Counts the passages of a document no finished critique reviewed (`waiting_passages`); never throws (the count is shown, the gate
     * does not depend on it).
     */
    private async recount(workspaceId: string, sourceId: string): Promise<void> {
        try {
            const row = await this.entityManager.findOne(SourceCritiqueEntity, {
                select: { id: true, reviewedHashes: true },
                where: { workspaceId, sourceId },
            })
            if (row === null) return
            const reviewed = new Set(row.reviewedHashes)
            const passages = (await this.chunks.passagesOf(workspaceId, sourceId)).map((one): CriticPassage => ({
                id: one.id,
                order: one.order,
                text: one.content,
                hash: passageTextHashOf(one.content),
            }))
            const exempt = await this.scope.exemptOf(workspaceId, sourceId, passages)
            const waiting = passages.filter((one) => !reviewed.has(one.hash) && !exempt.has(one.hash)).length
            await this.entityManager.update(
                SourceCritiqueEntity,
                { workspaceId, sourceId },
                { waitingPassages: waiting },
            )
        } catch (cause) {
            this.logger.error(DossierReviewLogEvent.CritiqueFailed, cause, { sourceId })
        }
    }

    /**
     * A RESUME by the upkeep tick: a critique that is not done and not given up waits again with its count of runs kept; one whose
     * worker went silent for 15 minutes (crash, restart) is taken back the same way, counted as a run without progress (it wrote no
     * end), so a run that dies every time is given up too. Answers whether it now waits; anything else (done, waiting, running,
     * given up, no critique) is left as it is.
     */
    private async resume(workspaceId: string, sourceId: string): Promise<boolean> {
        const row = await this.entityManager.findOne(SourceCritiqueEntity, {
            select: { id: true, state: true, attempts: true, startedAt: true },
            where: { workspaceId, sourceId },
        })
        if (row === null || row.attempts >= CRITIC_CAPS.runs) return false
        const counts = Array.from({ length: CRITIC_CAPS.runs }, (_, count) => count)
        const again = { state: "waiting" as const, reason: null, requestedAt: this.clock.now() }
        if (row.state === "not_done") {
            const moved = await this.entityManager.update(
                SourceCritiqueEntity,
                { workspaceId, sourceId, state: "not_done", attempts: In(counts) },
                again,
            )
            return (moved.affected ?? 0) > 0
        }
        if (row.state !== "running") return false
        const silent = await this.entityManager.update(
            SourceCritiqueEntity,
            {
                workspaceId,
                sourceId,
                state: "running",
                attempts: row.attempts,
                startedAt: LessThan(new Date(this.clock.now().getTime() - STALE_RUNNING_MS)),
            },
            { ...again, attempts: Math.min(row.attempts + 1, CRITIC_CAPS.runs) },
        )
        return (silent.affected ?? 0) > 0
    }

    /** Writes a NEW request of a critique: it waits (or will, after its running one), its count of runs without progress starts again. */
    private async ask(workspaceId: string, sourceId: string): Promise<void> {
        const asked = {
            state: "waiting" as const,
            reason: null,
            attempts: 0,
            requestedAt: this.clock.now(),
            releasedBy: null,
            releasedAt: null,
        }
        const moved = await this.entityManager.update(
            SourceCritiqueEntity,
            { workspaceId, sourceId, state: In(["waiting", "done", "not_done"]) },
            asked,
        )
        if ((moved.affected ?? 0) > 0) return
        // A critique whose worker went silent (crash, restart) for 15 minutes is taken back: it waits again.
        const stale = await this.entityManager.update(
            SourceCritiqueEntity,
            {
                workspaceId,
                sourceId,
                state: "running",
                startedAt: LessThan(new Date(this.clock.now().getTime() - STALE_RUNNING_MS)),
            },
            asked,
        )
        if ((stale.affected ?? 0) > 0) return
        if (await this.entityManager.exists(SourceCritiqueEntity, { where: { workspaceId, sourceId } })) {
            // A critique is running: it ends, then this new version waits for the next run (`end`, its count started again).
            await this.entityManager.update(
                SourceCritiqueEntity,
                { workspaceId, sourceId },
                { requestedAt: this.clock.now() },
            )
            return
        }
        await this.entityManager
            .createQueryBuilder()
            .insert()
            .into(SourceCritiqueEntity)
            .values({ workspaceId, sourceId, ...asked })
            .orIgnore()
            .execute()
    }

    /**
     * Carries out the waiting critiques of a workspace, the longest-waiting first, at most `CRITIC_CAPS.perRun` per run; never throws.
     * Answers how many ran. A critique that ended a slice of its work with progress (`takesAnotherTurn`) waits again BEHIND the others
     * (asked now), so one long document never holds the turn of the workspace's other documents (D-V-3); the runner's follow-up run
     * carries on with it.
     */
    async runWaiting(workspaceId: string): Promise<number> {
        try {
            const waiting = await this.entityManager.find(SourceCritiqueEntity, {
                select: { id: true, sourceId: true },
                where: { workspaceId, state: "waiting" },
                order: { requestedAt: "ASC" },
                take: CRITIC_CAPS.perRun,
            })
            let ran = 0
            await eachInOrder(waiting, async (row) => {
                // One document that fails never ends the batch (D-N-3): the others of the workspace are still critiqued.
                try {
                    const outcome = await this.critique(workspaceId, row.sourceId)
                    if (outcome.state !== "skipped") ran += 1
                } catch (cause) {
                    this.logger.error(DossierReviewLogEvent.CritiqueFailed, cause, { sourceId: row.sourceId })
                }
            })
            return ran
        } catch (cause) {
            this.logger.error(DossierReviewLogEvent.CritiqueFailed, cause, { workspaceId })
            return 0
        }
    }

    /**
     * One critique of one document; a failure leaves it `not_done` (reason model) and is logged, never thrown. Only a WAITING critique
     * is taken (D-N-3): a critique another run just ended (`done`, `not_done`) is that run's, not this one's. Taking it again made
     * the model read the document twice, and a `not_done` row taken with its reason still on it broke the table's check
     * (`not_done` if and only if a reason) and ended the whole run. Asking again goes through `request`, which makes it wait.
     */
    async critique(workspaceId: string, sourceId: string): Promise<CritiqueOutcome> {
        if (!(await this.claim(workspaceId, sourceId))) return SKIPPED
        const start = await this.startOf(workspaceId, sourceId)
        try {
            // Booked per stage of the document's AI work: the critique's own kind (the document's cost keeps read and critique apart)
            // with the step key `critique`, beside the reading's `triage`, `extract`, `relations`, `judge`, `index`.
            return await withWorkScope({ kind: CRITIQUE_WORK, ref: `source:${sourceId}`, stepKey: "critique" }, () =>
                this.carryOut(workspaceId, sourceId, start),
            )
        } catch (cause) {
            this.logger.error(DossierReviewLogEvent.CritiqueFailed, cause, { sourceId })
            await this.giveUp(workspaceId, sourceId, start)
            return { state: "not_done", reason: "model", calls: 0, found: 0 }
        }
    }

    /** What the row of a claimed critique says before its run (nothing reviewed and no mark when it cannot be read). */
    private async startOf(workspaceId: string, sourceId: string): Promise<RunStart> {
        const row = await this.entityManager.findOne(SourceCritiqueEntity, { where: { workspaceId, sourceId } })
        return { attempts: row?.attempts ?? 0, reviewed: row?.reviewedHashes.length ?? 0 }
    }

    /**
     * Takes a waiting critique: it runs, with no reason of an earlier end on it. Its count of runs without progress is KEPT (only a new
     * request starts it again). False when none waits or the write failed.
     */
    private async claim(workspaceId: string, sourceId: string): Promise<boolean> {
        try {
            const claimed = await this.entityManager.update(
                SourceCritiqueEntity,
                { workspaceId, sourceId, state: "waiting" },
                { state: "running", reason: null, startedAt: this.clock.now() },
            )
            return (claimed.affected ?? 0) > 0
        } catch (cause) {
            this.logger.error(DossierReviewLogEvent.CritiqueFailed, cause, { sourceId })
            return false
        }
    }

    /**
     * Ends a critique that failed unexpectedly as not done (`model`), counted like any run: one more run without progress unless its
     * finished calls stored reviewed passages before it failed. A failure of that write is logged, never thrown (a
     * running row that stays silent is taken back by the next request, or by a resume that counts it).
     */
    private async giveUp(workspaceId: string, sourceId: string, start: RunStart): Promise<void> {
        try {
            const now = await this.startOf(workspaceId, sourceId)
            const progressed = now.reviewed > start.reviewed
            const attempts = runsAfter(start.attempts, { state: "not_done", reason: "model", progressed, exhausted: false })
            await this.end(workspaceId, sourceId, { state: "not_done", reason: "model", attempts })
            if (attempts >= CRITIC_CAPS.runs) this.logger.warn(DossierReviewLogEvent.CritiqueGivenUp, { sourceId, runs: attempts })
            // A failed run ends like any other: the truths work is told.
            await this.changed(workspaceId, sourceId)
        } catch (cause) {
            this.logger.error(DossierReviewLogEvent.CritiqueFailed, cause, { sourceId })
        }
    }

    /** What a critique reads about a document; null when the document is gone. */
    async inputOf(
        workspaceId: string,
        sourceId: string,
        reviewed: ReadonlyArray<string>,
    ): Promise<OptionalCritiqueInput> {
        const [source] = await this.sources.briefsOf(workspaceId, [sourceId])
        if (source === undefined) return null
        // EVERY passage: one model call reads at most `CRITIC_CAPS.passages` of the changed ones and the critique calls again for the rest.
        const stored = await this.chunks.passagesOf(workspaceId, sourceId)
        const passages: Array<CriticPassage> = stored.map((one) => ({
            id: one.id,
            order: one.order,
            text: one.content,
            hash: passageTextHashOf(one.content),
        }))
        const records = await this.reads.ofSources(workspaceId, [sourceId], ["proposed", "active"], FACTS_MAX)
        const near: ReadonlyMap<string, ReadonlyArray<TruthCandidate>> = records.length === 0
            ? new Map()
            : await this.truths.candidatesFor(workspaceId, records, {
                  perFact: CRITIC_CAPS.perFact,
                  excludeSourceId: sourceId,
              })
        const named = await this.namedOf(workspaceId, sourceId, records)
        const asked = await this.askedOf(workspaceId, sourceId, records)
        const candidates = new Map<string, ReadonlyArray<CriticCandidate>>(
            records.map((fact) => {
                const found = [...(near.get(fact.id) ?? []), ...(named.get(fact.id) ?? [])]
                // One candidate per truth: a truth found twice keeps the way it was found first (the key before the name).
                const unique = [...new Map(found.map((one) => [one.fact.id, one] as const).reverse()).values()].reverse()
                return [
                    fact.id,
                    unique.map((one): CriticCandidate => ({
                        fact: criticFactOf(one.fact, null),
                        distance: one.distance,
                        match: one.match,
                        sourceTitle: titleOf(one.fact),
                    })),
                ]
            }),
        )
        return {
            workspaceId,
            sourceId,
            say: (key, params) => this.catalog.get(`critic.${key}`, { ...params }, "vi"),
            title: source.title,
            today: this.clock.now().toISOString().slice(0, 10),
            passages,
            reviewed: new Set(reviewed),
            facts: records.map((fact) => criticFactOf(fact, sourceId)),
            candidates,
            asked,
        }
    }

    /**
     * The pairs of truths of this document an open contradiction point of ANOTHER document already asks about: the rules raise no twin
     * of that point here (one point per pair, on the side critiqued first). By ids only.
     */
    private async askedOf(workspaceId: string, sourceId: string, records: ReadonlyArray<FactRecord>): Promise<ReadonlySet<string>> {
        const mine = new Set(records.map((fact) => fact.id))
        const points = (await this.otherPointsNaming(workspaceId, sourceId, [...mine])).filter(
            (point) => point.origin === "rule" && holdingPoint(point),
        )
        return new Set(
            points.flatMap((point) =>
                point.factIds.flatMap((id, index) =>
                    point.factIds.slice(index + 1).flatMap((other) => (mine.has(id) || mine.has(other) ? [contradictionPairOf(id, other)] : [])),
                ),
            ),
        )
    }

    /**
     * Per waiting truth of the document, the truth the same-fact judge linked it to (`conflictWith`: the same thing, read under another
     * key), when that truth is IN FORCE or WAITING from another document: the rules set the two values against each other
     * (`linkedFacts`). By ids and states only; a truth that is this document's own (it updates itself) is not one.
     */
    private async namedOf(workspaceId: string, sourceId: string, records: ReadonlyArray<FactRecord>): Promise<ReadonlyMap<string, ReadonlyArray<TruthCandidate>>> {
        const linked = records.filter((fact) => fact.status === "proposed" && fact.conflictWith !== null)
        const ids = [...new Set(linked.flatMap((fact) => (fact.conflictWith === null ? [] : [fact.conflictWith])))]
        if (ids.length === 0) return new Map()
        const others = new Map(
            (await this.reads.byIds(workspaceId, ids))
                .filter(
                    (fact) =>
                        (fact.status === "active" || fact.status === "proposed") &&
                        !fact.evidence.every((item) => item.kind === "document" && item.ref === sourceId),
                )
                .map((fact) => [fact.id, fact] as const),
        )
        return new Map(
            linked.flatMap((fact) => {
                const target = others.get(fact.conflictWith ?? "")
                return target === undefined ? [] : [[fact.id, [{ fact: target, distance: null, match: "named" }]] as const]
            }),
        )
    }

    private async carryOut(workspaceId: string, sourceId: string, start: RunStart): Promise<CritiqueOutcome> {
        const row = await this.entityManager.findOne(SourceCritiqueEntity, { where: { workspaceId, sourceId } })
        const stored = await this.inputOf(workspaceId, sourceId, row?.reviewedHashes ?? [])
        if (stored === null) return SKIPPED
        // The minimal set: the model reads only what a gate needs (see `exemptPassageIds`).
        const exempt = await this.scope.exemptOf(workspaceId, sourceId, stored.passages)
        const reading = await this.extractions.get(workspaceId, sourceId)
        const input: CritiqueInput = { ...stored, reviewed: new Set([...stored.reviewed, ...exempt]) }
        const ruled = ruleCritique(input)
        const rules = ruled.points
        if (ruled.capped.length > 0) this.logger.info(DossierReviewLogEvent.CritiqueCapped, { sourceId, capped: ruled.capped })
        const factsUnread = reading !== null && (reading.status === "failed" || reading.status === "blocked_credits")
        const run: CritiqueRun = factsUnread
            ? { reviewed: input.reviewed, calls: 0, tries: 0, promptTokens: 0, found: 0, reason: "facts_unread" }
            : await this.callsOver(input, rules, stored.reviewed.size === 0)
        // The rule points always stand; a call that read passages already wrote its own points with them.
        if (run.reviewed === input.reviewed) await this.persist(input, rules, new Set())
        const present = new Set(input.passages.map((passage) => passage.hash))
        // Only what a model call read is stored as reviewed: an exempt passage is never marked reviewed, so it is read by the model
        // once it needs to be (its document made public, or triage judging it a rule).
        const reviewed = [...run.reviewed].filter(
            (hash) => present.has(hash) && (!exempt.has(hash) || stored.reviewed.has(hash)),
        )
        const waiting = input.passages.filter((passage) => !run.reviewed.has(passage.hash)).length
        const counted = this.counted(sourceId, start, {
            reason: run.reason,
            progressed: run.reviewed.size > input.reviewed.size,
            waiting,
        })
        const { state, reason } = counted
        await this.end(workspaceId, sourceId, {
            state,
            reason,
            attempts: counted.attempts,
            ...(state === "waiting" ? { requestedAt: this.clock.now() } : {}),
            reviewedHashes: reviewed,
            waitingPassages: waiting,
            modelCalls: (row?.modelCalls ?? 0) + run.calls,
            promptTokens: (row?.promptTokens ?? 0) + run.promptTokens,
        })
        await this.regate(workspaceId, sourceId)
        await this.changed(workspaceId, sourceId)
        return { state, reason, calls: run.calls, found: rules.length + run.found }
    }

    /**
     * THE COUNT OF RUNS of a run that ended (D-V-1): a run that reviewed no new passage counts one more, so a critique that cannot
     * progress is given up after `CRITIC_CAPS.runs` runs however often it is resumed (logged); a slice of work with progress waits
     * again, behind the workspace's others (D-V-3), with no reason on it. Answers the state, reason and count the row is ended with.
     */
    private counted(sourceId: string, start: RunStart, run: RunOutcome): CountedEnd {
        const { reason, waiting } = run
        const ended: CritiqueRunEnd = {
            state: reason === null ? "done" : "not_done",
            reason,
            progressed: run.progressed,
            exhausted: waiting === 0,
        }
        const attempts = runsAfter(start.attempts, ended)
        if (takesAnotherTurn(ended)) {
            this.logger.info(DossierReviewLogEvent.CritiqueTurnGiven, { sourceId, waiting })
            return { state: "waiting", reason: null, attempts }
        }
        if (ended.state === "not_done") {
            this.logger.warn(DossierReviewLogEvent.CritiqueNotDone, { sourceId, reason, waiting, runs: attempts })
            if (attempts >= CRITIC_CAPS.runs) this.logger.warn(DossierReviewLogEvent.CritiqueGivenUp, { sourceId, runs: attempts, waiting })
        }
        return { state: ended.state, reason, attempts }
    }

    /**
     * The model part of one critique: a call over the next changed passages (at most `changedChars` / `passages`), its points written at
     * once, then the next call over the rest, until no changed passage is left (`done`), a call fails after its tries (`model`), the
     * credit pool is empty (`credits`), or the technical bound of calls is reached (`budget`, the waiting passages are counted). The
     * running row's `startedAt` is renewed before each call, so a long critique is never taken back as silent.
     */
    private callsOver(input: CritiqueInput, rules: ReadonlyArray<CriticPoint>, first: boolean): Promise<CritiqueRun> {
        return this.callFrom(input, rules, first, 0, {
            reviewed: input.reviewed,
            calls: 0,
            tries: 0,
            promptTokens: 0,
            found: 0,
            reason: null,
        })
    }

    /** The call number `call` of a critique over what is still unreviewed, then the next one (each reads what the one before left). */
    private async callFrom(
        input: CritiqueInput,
        rules: ReadonlyArray<CriticPoint>,
        first: boolean,
        call: number,
        run: CritiqueRun,
    ): Promise<CritiqueRun> {
        const now: CritiqueInput = { ...input, reviewed: run.reviewed }
        const built = buildCritique(now, first)
        if (built === null) return run
        if (call >= CRITIC_CAPS.callsPerCritique) return { ...run, reason: "budget" }
        await this.entityManager.update(
            SourceCritiqueEntity,
            { workspaceId: input.workspaceId, sourceId: input.sourceId, state: "running" },
            { startedAt: this.clock.now() },
        )
        const part = await this.askModel(now, first, built)
        const asked = { ...run, calls: run.calls + part.calls, tries: part.tries }
        if (part.answer === null) return { ...asked, reason: part.reason ?? "model" }
        const refused = part.answer.refused ?? []
        if (refused.length > 0) {
            // A point that did not fit the shape of a point was left out; the other points of the answer stand (D-N-2).
            this.logger.warn(DossierReviewLogEvent.CritiqueRefused, { sourceId: input.sourceId, refused })
        }
        // Only text addressed to an AI is kept: a finding of any other kind is dropped and counted (`removed_kind`).
        const guarded = guardCritique(part.answer, part.built, now)
        if (guarded.dropped.length > 0) {
            this.logger.info(DossierReviewLogEvent.CritiqueDropped, {
                sourceId: input.sourceId,
                dropped: guarded.dropped.length,
                reasons: [...new Set(guarded.dropped)],
            })
        }
        const { kept } = guarded
        // The points of this call are written before the next call.
        await this.persist(now, [...rules, ...kept], part.built.changed)
        await this.keepReviewed(input, part.built.changed)
        return this.callFrom(input, rules, first, call + 1, {
            ...asked,
            promptTokens: asked.promptTokens + (part.answer.promptTokens ?? 0),
            found: asked.found + kept.length,
            reviewed: new Set([...run.reviewed, ...part.built.changed]),
        })
    }

    /**
     * One model call, up to three tries in total (the owner's AI-error rule), each try only while the credit pool allows it. A try is
     * never the one before it sent again in the hope of another answer (D-N-2: three identical tries gave three identical refusals):
     * - the model did not answer (`unavailable`: a timeout, a provider error): the same call again, the failure was not the prompt's;
     * - its answer was not the JSON object asked for (`unreadable`): ONE more try that tells it so; unreadable again ends the tries;
     * - its answer was cut at the token cap (`cut`): the next try reads half the passages, so its answer is shorter; a single
     *   passage whose answer is cut ends the tries (the passages left unread are counted as waiting).
     */
    private askModel(input: CritiqueInput, first: boolean, whole: BuiltCritique): Promise<ModelPart> {
        const narrower: Narrower = (built) => {
            const window = narrowerWindow(built)
            return window === null ? null : buildCritique(input, first, window)
        }
        return this.tryFrom(input.workspaceId, { built: whole, after: undefined }, narrower, 1, 0)
    }

    /** The try number `tries` of a model call (`calls` answers were paid for before it), then the next one when this one failed. */
    private async tryFrom(workspaceId: string, plan: TryPlan, narrower: Narrower, tries: number, calls: number): Promise<ModelPart> {
        if (await this.usage.blockedBy(workspaceId, "brain", false))
            return { answer: null, built: plan.built, calls, tries: tries - 1, reason: "credits" }
        const outcome = await this.model.critique(plan.built.bundle, plan.after)
        const paid = outcome.ok || outcome.reason !== "unavailable" ? calls + 1 : calls
        if (outcome.ok) return { answer: outcome.answer, built: plan.built, calls: paid, tries, reason: null }
        const next = tries >= CRITIC_CAPS.tries ? null : this.nextTry(outcome.reason, plan, narrower)
        if (next === null) return { answer: null, built: plan.built, calls: paid, tries, reason: "model" }
        return this.tryFrom(workspaceId, next, narrower, tries + 1, paid)
    }

    /** What the try after a failed one sends, or null when another try would only be the same call again. */
    private nextTry(reason: CritiqueFailure, plan: TryPlan, narrower: Narrower): TryPlan | null {
        if (reason === "unavailable") return plan
        if (reason === "unreadable") return plan.after === "unreadable" ? null : { built: plan.built, after: "unreadable" }
        const built = narrower(plan.built)
        return built === null ? null : { built, after: undefined }
    }

    /**
     * Stores the passages a finished call read, at once: a critique that stops before its end (a crash, a restart, a later call that
     * fails) is picked up from the passages still unread, never from its start, and no passage is paid for twice.
     */
    private async keepReviewed(input: CritiqueInput, read: ReadonlySet<string>): Promise<void> {
        const where = { workspaceId: input.workspaceId, sourceId: input.sourceId }
        const row = await this.entityManager.findOne(SourceCritiqueEntity, { select: { id: true, reviewedHashes: true }, where })
        if (row === null) return
        await this.entityManager.update(SourceCritiqueEntity, where, {
            reviewedHashes: [...new Set([...row.reviewedHashes, ...read])],
        })
    }

    /** The stored points of a document. */
    pointsOf(workspaceId: string, sourceId: string): Promise<ReadonlyArray<DossierFindingEntity>> {
        return this.entityManager.find(DossierFindingEntity, {
            where: {
                workspaceId,
                dossierId: IsNull(),
                sourceIds: ArrayContains([sourceId]),
                ruleKey: Like(`${CRITIC_RULE_PREFIX}%`),
            },
            take: 2_000,
        })
    }

    /** Writes what the critique found against the stored points of the document, in one transaction. */
    private async persist(
        input: CritiqueInput,
        found: ReadonlyArray<CriticPoint>,
        reread: ReadonlySet<string>,
    ): Promise<void> {
        const now = this.clock.now()
        // EVERY stored point of the document, old verdict points and points of removed kinds included: the reconcile closes those
        // (`not_detected`, D5), since nothing raises them any more.
        const stored = (await this.pointsOf(input.workspaceId, input.sourceId)).filter(
            (row) => row.params.sourceId === input.sourceId,
        )
        const outcome = reconcileCritique(
            {
                sourceId: input.sourceId,
                stored,
                // Each point is stored with the truths it names (every truth read from the lines it quotes), so it holds those only.
                found: found.map((point) => ({ point: namedTruths(point, input.facts), fingerprint: criticFingerprintOf(input.sourceId, point) })),
                present: new Set(input.passages.map((passage) => passage.hash)),
                reread,
            },
            now,
        )
        await this.entityManager.transaction(async (tx) => {
            if (outcome.inserts.length > 0) {
                await tx.insert(DossierFindingEntity, newPointRows(input.workspaceId, input.sourceId, outcome.inserts, now))
            }
            await eachInOrder(outcome.changes, async (change) => {
                await tx.update(DossierFindingEntity, { id: change.id, workspaceId: input.workspaceId }, change.changes)
            })
        })
    }

    /** Ends a critique with its state. */
    private async end(workspaceId: string, sourceId: string, changes: Partial<SourceCritiqueEntity>): Promise<void> {
        await this.entityManager.update(
            SourceCritiqueEntity,
            { workspaceId, sourceId },
            { ...changes, finishedAt: this.clock.now() },
        )
        // A newer version was uploaded while this critique ran: it waits for the next run instead of passing as reviewed, as a NEW
        // request does (its count of runs without progress starts again). A slice that waits again was asked by its own end, after
        // its start, so it is moved here too: its count is 0 already.
        await this.entityManager
            .createQueryBuilder()
            .update(SourceCritiqueEntity)
            .set({ state: "waiting", reason: null, attempts: 0 })
            .where(
                "workspaceId = :workspaceId AND sourceId = :sourceId AND startedAt IS NOT NULL AND requestedAt > startedAt",
                {
                    workspaceId,
                    sourceId,
                },
            )
            .execute()
    }

    /**
     * Sets the trust gate of every stored passage of a document (the ONE place customer readiness is written: after a critique, an
     * answer, a skip, a release): served when the security read reviewed it (text addressed to an AI is exactly what a customer's
     * agent must not be handed) AND no open HOLDING point quotes it (`heldHashes`: a contradiction of the rules, or text addressed
     * to an AI; an old point of a removed kind holds nothing). A release serves nothing unreviewed (`customerReadyOf`). The vector
     * index is told in the same transaction (`vector.sync`).
     */
    async regate(workspaceId: string, sourceId: string): Promise<void> {
        const row = await this.entityManager.findOne(SourceCritiqueEntity, { where: { workspaceId, sourceId } })
        if (row === null) return
        const open = (await this.pointsOf(workspaceId, sourceId)).filter(
            (point) => point.status === "open" || point.status === "confirmed",
        )
        const gate = {
            reviewed: new Set(row.reviewedHashes),
            held: heldHashes(open),
            released: row.releasedAt !== null,
        }
        const passages = await this.chunks.passagesOf(workspaceId, sourceId)
        const ready = passages
            .filter((one) => customerReadyOf(passageTextHashOf(one.content), gate))
            .map((one) => one.id)
        const flip = `UPDATE public.knowledge_chunks SET ${CUSTOMER_READY_COLUMN} = (id = ANY($3::uuid[])) WHERE workspace_id = $1 AND source_id = $2`
        await this.entityManager.transaction(async (tx) => {
            await tx.query(flip, [workspaceId, sourceId, ready])
            await this.vectorSync?.changedSource(workspaceId, sourceId, tx)
        })
    }

    /** A document was deleted: its open points close as no longer in the document (its critique row goes with it). */
    async forget(workspaceId: string, sourceId: string): Promise<void> {
        const now = this.clock.now()
        const open = (await this.pointsOf(workspaceId, sourceId)).filter(
            (point) => point.status === "open" || point.status === "confirmed",
        )
        if (open.length === 0) return
        await this.entityManager.update(
            DossierFindingEntity,
            { workspaceId, id: In(open.map((point) => point.id)) },
            {
                status: "resolved",
                resolution: "not_detected",
                resolvedAt: now,
                decisionNote: GONE_NOTES.gone,
                lastSeenAt: now,
            },
        )
    }
}
