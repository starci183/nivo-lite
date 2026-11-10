import { Injectable } from "@nestjs/common"
import { ArrayContains, In, IsNull, LessThan, Like, MoreThanOrEqual, type EntityManager } from "typeorm"
import { BrainExtractionsService } from "@modules/domain/brain-extractions"
import { BrainFactsReadService, type FactRecord } from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import {
    CUSTOMER_READY_COLUMN,
    customerReadyOf,
    KnowledgeChunksService,
    passageTextHashOf,
} from "@modules/domain/knowledge-chunks"
import { DossierSourcesService } from "@modules/domain/knowledge-sources"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger, type Logger, withWorkScope } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import {
    CRITIC_CAPS,
    CRITIC_RULE_PREFIX,
    type CriticCandidate,
    type CriticFact,
    type CriticPassage,
    type CriticPoint,
    type CritiqueInput,
    type NotDoneReason,
} from "./document-critic.contracts"
import { buildCritique, guardCritique, type BuiltCritique } from "./document-critic-model.policy"
import {
    InjectDocumentCriticModel,
    InjectShopTruthCandidates,
    type CritiqueAnswer,
    type DocumentCriticModel,
    type ShopTruthCandidates,
    type TruthCandidate,
} from "./document-critic.port"
import {
    GONE_NOTES,
    criticFingerprintOf,
    heldHashes,
    pointColumns,
    reconcileCritique,
} from "./document-critic-reconcile.policy"
import { criticRules } from "./document-critic-rules.policy"
import { DossierReviewLogEvent } from "./dossier-review.log-events"
import { DossierFindingEntity, SourceCritiqueEntity } from "./persistence/entities"

/** How long a running critique may stay silent before a new request takes it back. */
const STALE_RUNNING_MS = 15 * 60_000

/** The most facts of one document the critic reads. */
const FACTS_MAX = 200

/** What one critique did. */
export interface CritiqueOutcome {
    /** Where it ended. */
    readonly state: "done" | "not_done" | "skipped"
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
    readonly calls: number
    readonly tries: number
    readonly reason: NotDoneReason | null
}

const documentEvidenceOf = (fact: FactRecord, sourceId: string) =>
    fact.evidence.find((item) => item.kind === "document" && item.ref === sourceId) ?? null

const titleOf = (fact: FactRecord): string | null =>
    fact.evidence.find((item) => item.kind === "document")?.title ?? fact.evidence.find((item) => item.kind === "document")?.label ?? null

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
    }
}

@Injectable()
/**
 * The deep critic of a SHOP document (owner's order 2026-11-11: argue with a document at its first upload; on a later upload argue
 * again about what changed and move only the affected part of the graph). It runs inside the review job that follows every facts reading: deterministic rules over the whole document
 * first (cheap, exact), then ONE model call over the passages no finished critique read (the whole document on the first upload, only the
 * changed passages later), three tries at most, then "not done" shown honestly — never a silent pass. It only questions: it never changes a
 * fact. Its points live in `dossier_findings` (no dossier, rule key `shop.<kind>`), and it opens the trust gate of the document's passages
 * for customer-facing searches once it ran, except passages under an open high point.
 */
export class DocumentCriticService {
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
        private readonly sources: DossierSourcesService,
        private readonly usage: UsageMeterService,
    ) {}

    /** The facts of a document were read (or given up on): its critique waits for the review run; a founder's earlier release ends. */
    async request(workspaceId: string, sourceId: string): Promise<void> {
        const asked = { state: "waiting" as const, reason: null, attempts: 0, requestedAt: this.clock.now(), releasedBy: null, releasedAt: null }
        const moved = await this.entityManager.update(SourceCritiqueEntity, { workspaceId, sourceId, state: In(["waiting", "done", "not_done"]) }, asked)
        if ((moved.affected ?? 0) > 0) return
        // A critique whose worker went silent (crash, restart) for 15 minutes is taken back: it waits again.
        const stale = await this.entityManager.update(
            SourceCritiqueEntity,
            { workspaceId, sourceId, state: "running", startedAt: LessThan(new Date(this.clock.now().getTime() - STALE_RUNNING_MS)) },
            asked,
        )
        if ((stale.affected ?? 0) > 0) return
        if (await this.entityManager.exists(SourceCritiqueEntity, { where: { workspaceId, sourceId } })) {
            // A critique is running: it ends, then this new version waits for the next run.
            await this.entityManager.update(SourceCritiqueEntity, { workspaceId, sourceId }, { requestedAt: this.clock.now() })
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

    /** Carries out the waiting critiques of a workspace, oldest first, at most ten per run; never throws. Answers how many ran. */
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
                const outcome = await this.critique(workspaceId, row.sourceId)
                if (outcome.state !== "skipped") ran += 1
            })
            return ran
        } catch (cause) {
            this.logger.error(DossierReviewLogEvent.CritiqueFailed, cause, { workspaceId })
            return 0
        }
    }

    /** One critique of one document; a failure leaves it `not_done` (reason model) and is logged, never thrown. */
    async critique(workspaceId: string, sourceId: string): Promise<CritiqueOutcome> {
        const now = this.clock.now()
        const claimed = await this.entityManager.update(
            SourceCritiqueEntity,
            { workspaceId, sourceId, state: In(["waiting", "not_done", "done"]) },
            { state: "running", startedAt: now, attempts: 0 },
        )
        if ((claimed.affected ?? 0) === 0) return SKIPPED
        try {
            return await withWorkScope({ kind: "document_critique", ref: `source:${sourceId}` }, () =>
                this.carryOut(workspaceId, sourceId),
            )
        } catch (cause) {
            this.logger.error(DossierReviewLogEvent.CritiqueFailed, cause, { sourceId })
            await this.end(workspaceId, sourceId, { state: "not_done", reason: "model" })
            return { state: "not_done", reason: "model", calls: 0, found: 0 }
        }
    }

    /** What a critique reads about a document; null when the document is gone. */
    async inputOf(workspaceId: string, sourceId: string, reviewed: ReadonlyArray<string>): Promise<CritiqueInput | null> {
        const source = await this.sources.sourceOf(workspaceId, sourceId)
        if (source === null) return null
        const stored = await this.chunks.passagesOf(workspaceId, sourceId)
        const passages: Array<CriticPassage> = stored
            .slice(0, CRITIC_CAPS.passages)
            .map((one) => ({ id: one.id, order: one.order, text: one.content, hash: passageTextHashOf(one.content) }))
        const records = await this.reads.ofSources(workspaceId, [sourceId], ["proposed", "active"], FACTS_MAX)
        const near: ReadonlyMap<string, ReadonlyArray<TruthCandidate>> = records.length === 0 ? new Map() : await this.truths.candidatesFor(workspaceId, records, { perFact: CRITIC_CAPS.perFact, excludeSourceId: sourceId })
        const candidates = new Map<string, ReadonlyArray<CriticCandidate>>(
            records.map((fact) => [
                fact.id,
                (near.get(fact.id) ?? []).map(
                    (one): CriticCandidate => ({ fact: criticFactOf(one.fact, null), distance: one.distance, match: one.match, sourceTitle: titleOf(one.fact) }),
                ),
            ]),
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
        }
    }

    private async carryOut(workspaceId: string, sourceId: string): Promise<CritiqueOutcome> {
        const row = await this.entityManager.findOne(SourceCritiqueEntity, { where: { workspaceId, sourceId } })
        const input = await this.inputOf(workspaceId, sourceId, row?.reviewedHashes ?? [])
        if (input === null) return SKIPPED
        const rules = criticRules(input)
        const reading = await this.extractions.get(workspaceId, sourceId)
        const factsUnread = reading !== null && (reading.status === "failed" || reading.status === "blocked_credits")
        const built = factsUnread ? null : buildCritique(input, rules)
        const part: ModelPart = factsUnread
            ? { answer: null, calls: 0, tries: 0, reason: "facts_unread" }
            : built === null
              ? { answer: null, calls: 0, tries: 0, reason: null }
              : await this.askModel(workspaceId, built)
        const guarded = part.answer === null || built === null ? { kept: [], dropped: [] } : guardCritique(part.answer, built, input, rules)
        if (guarded.dropped.length > 0) {
            this.logger.info(DossierReviewLogEvent.CritiqueDropped, { sourceId, dropped: guarded.dropped.length })
        }
        const found: Array<CriticPoint> = [...rules, ...guarded.kept]
        const reread = part.answer === null || built === null ? new Set<string>() : built.changed
        await this.persist(input, found, reread)
        const present = new Set(input.passages.map((passage) => passage.hash))
        const reviewed = [...new Set([...(row?.reviewedHashes ?? []).filter((hash) => present.has(hash)), ...reread])]
        const state = part.reason === null ? "done" : "not_done"
        if (state === "not_done") this.logger.warn(DossierReviewLogEvent.CritiqueNotDone, { sourceId, reason: part.reason })
        await this.end(workspaceId, sourceId, {
            state,
            reason: part.reason,
            attempts: part.tries,
            reviewedHashes: reviewed,
            modelCalls: (row?.modelCalls ?? 0) + part.calls,
            promptTokens: (row?.promptTokens ?? 0) + (part.answer?.promptTokens ?? 0),
        })
        await this.regate(workspaceId, sourceId)
        return { state, reason: part.reason, calls: part.calls, found: found.length }
    }

    /** The model calls of critiques in the workspace's last 24 hours, counted from the tries of the critiques that ended. */
    private async dailyCalls(workspaceId: string): Promise<number> {
        const since = new Date(this.clock.now().getTime() - 86_400_000)
        const rows = await this.entityManager.find(SourceCritiqueEntity, {
            select: { id: true, attempts: true },
            where: { workspaceId, finishedAt: MoreThanOrEqual(since) },
            take: 1_000,
        })
        return rows.reduce((sum, one) => sum + one.attempts, 0)
    }

    /** One model call, up to three tries in total (the owner's AI-error rule), within the credits and the daily cap. */
    private async askModel(workspaceId: string, built: BuiltCritique): Promise<ModelPart> {
        if ((await this.dailyCalls(workspaceId)) >= CRITIC_CAPS.dailyCalls) return { answer: null, calls: 0, tries: 0, reason: "budget" }
        let calls = 0
        for (let tries = 1; tries <= CRITIC_CAPS.tries; tries += 1) {
            if (await this.usage.blockedBy(workspaceId, "brain", false)) return { answer: null, calls, tries: tries - 1, reason: "credits" }
            const outcome = await this.model.critique(built.bundle)
            if (outcome.ok || outcome.reason === "unreadable") calls += 1
            if (outcome.ok) return { answer: outcome.answer, calls, tries, reason: null }
        }
        return { answer: null, calls, tries: CRITIC_CAPS.tries, reason: "model" }
    }

    /** The stored points of a document. */
    async pointsOf(workspaceId: string, sourceId: string): Promise<ReadonlyArray<DossierFindingEntity>> {
        return this.entityManager.find(DossierFindingEntity, {
            where: { workspaceId, dossierId: IsNull(), sourceIds: ArrayContains([sourceId]), ruleKey: Like(`${CRITIC_RULE_PREFIX}%`) },
            take: 2_000,
        })
    }

    /** Writes what the critique found against the stored points of the document, in one transaction. */
    private async persist(input: CritiqueInput, found: ReadonlyArray<CriticPoint>, reread: ReadonlySet<string>): Promise<void> {
        const now = this.clock.now()
        const stored = (await this.pointsOf(input.workspaceId, input.sourceId)).filter(
            (row) => row.params.sourceId === input.sourceId,
        )
        const outcome = reconcileCritique(
            {
                sourceId: input.sourceId,
                stored,
                found: found.map((point) => ({ point, fingerprint: criticFingerprintOf(input.sourceId, point) })),
                present: new Set(input.passages.map((passage) => passage.hash)),
                reread,
            },
            now,
        )
        await this.entityManager.transaction(async (tx) => {
            if (outcome.inserts.length > 0) {
                await tx.insert(
                    DossierFindingEntity,
                    outcome.inserts.map((item) => ({
                        ...pointColumns(input.sourceId, item.point),
                        workspaceId: input.workspaceId,
                        fingerprint: item.fingerprint,
                        firstSeenAt: now,
                        lastSeenAt: now,
                    })),
                )
            }
            await eachInOrder(outcome.changes, async (change) => {
                await tx.update(DossierFindingEntity, { id: change.id, workspaceId: input.workspaceId }, change.changes)
            })
        })
    }

    /** Ends a critique with its state. */
    private async end(workspaceId: string, sourceId: string, changes: Partial<SourceCritiqueEntity>): Promise<void> {
        await this.entityManager.update(SourceCritiqueEntity, { workspaceId, sourceId }, { ...changes, finishedAt: this.clock.now() })
        // A newer version was uploaded while this critique ran: it waits for the next run instead of passing as reviewed.
        await this.entityManager
            .createQueryBuilder()
            .update(SourceCritiqueEntity)
            .set({ state: "waiting", reason: null })
            .where("workspaceId = :workspaceId AND sourceId = :sourceId AND startedAt IS NOT NULL AND requestedAt > startedAt", {
                workspaceId,
                sourceId,
            })
            .execute()
    }

    /**
     * Sets the trust gate of every stored passage of a document: served to customers when a finished critique read it (or the founder
     * released the document) and no open high point quotes it. A document with no critique row (stored before the gate) is left as it is.
     */
    async regate(workspaceId: string, sourceId: string): Promise<void> {
        const row = await this.entityManager.findOne(SourceCritiqueEntity, { where: { workspaceId, sourceId } })
        if (row === null) return
        const open = (await this.pointsOf(workspaceId, sourceId)).filter((point) => point.status === "open" || point.status === "confirmed")
        const gate = { reviewed: new Set(row.reviewedHashes), held: heldHashes(open), released: row.releasedAt !== null }
        const passages = await this.chunks.passagesOf(workspaceId, sourceId)
        const ready = passages.filter((one) => customerReadyOf(passageTextHashOf(one.content), gate)).map((one) => one.id)
        // The column is written by name: the entity of knowledge-chunks (BG1) maps it once BG1 adds the property (request filed).
        await this.entityManager.query(
            `UPDATE public.knowledge_chunks SET ${CUSTOMER_READY_COLUMN} = (id = ANY($3::uuid[])) WHERE workspace_id = $1 AND source_id = $2`,
            [workspaceId, sourceId, ready],
        )
    }

    /** A document was deleted: its open points close as no longer in the document (its critique row goes with it). */
    async forget(workspaceId: string, sourceId: string): Promise<void> {
        const now = this.clock.now()
        const open = (await this.pointsOf(workspaceId, sourceId)).filter((point) => point.status === "open" || point.status === "confirmed")
        if (open.length === 0) return
        await this.entityManager.update(
            DossierFindingEntity,
            { workspaceId, id: In(open.map((point) => point.id)) },
            { status: "resolved", resolution: "not_detected", resolvedAt: now, decisionNote: GONE_NOTES.gone, lastSeenAt: now },
        )
    }
}
