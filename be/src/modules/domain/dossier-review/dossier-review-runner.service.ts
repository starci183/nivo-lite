import { Injectable } from "@nestjs/common"
import { In, IsNull } from "typeorm"
import type { EntityManager } from "typeorm"
import { UsageMeterService } from "@modules/domain/knowledge"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { isDossierReviewPayload } from "@modules/queues/knowledge"
import { UNFILED_DOSSIER_ID, UNFILED_DOSSIER_NAME } from "./dossier-inputs.contracts"
import type { DossierInputs, FindingCandidate, ReviewContext, RuleOutput } from "./dossier-inputs.contracts"
import { DOSSIER_REVIEW_CAPS, FINDING_SEVERITIES, JOB_FAILED } from "./dossier-review.contracts"
import type { AiState, JobOutcome } from "./dossier-review.contracts"
import { InjectDossierReasoner } from "./dossier-review.decorators"
import { DossierReviewLogEvent } from "./dossier-review.log-events"
import type { DossierReasoner } from "./dossier-review.port"
import { statusOf } from "./dossier-status.policy"
import { guardCandidates } from "./evidence.policy"
import type { DropReason, EvidenceCorpus, GuardOutcome, KnownFinding } from "./evidence.policy"
import { toFindingRows, toFindingUpdate, toStoredFinding } from "./finding-record.mapper"
import { citedIds, coverageKey, evidenceHashOf, fingerprintOf } from "./fingerprint.policy"
import { DossierFindingEntity, DossierReviewEntity, DossierReviewRunEntity } from "./persistence/entities"
import { reconcile } from "./reconcile.policy"
import type { Reconciliation } from "./reconcile.policy"
import { buildBundle, corpusOf, inputsFingerprintOf, reasonedCandidates, resolvedByModel } from "./review-bundle.policy"
import { ReviewCriticService } from "./review-critic.service"
import { ReviewInputsService } from "./review-inputs.service"
import { RULE_KEYS, runRules } from "./rule-engine.policy"

/** The most stored findings one run reads. */
const STORED_MAX = 5_000

/** What a run reads before the model pass. */
interface RunPass {
    /** The claimed run. */
    readonly run: DossierReviewRunEntity
    /** The instant of the run. */
    readonly now: Date
    /** The dossiers of the pass. */
    readonly context: ReviewContext
    /** The dossiers the model reads. */
    readonly targetIds: ReadonlyArray<string>
    /** What evidence is checked against. */
    readonly corpus: EvidenceCorpus
    /** What the rules found and evaluated. */
    readonly rules: RuleOutput
    /** The rule candidates after the evidence check. */
    readonly ruleGuard: GuardOutcome
    /** The stored findings of the pass. */
    readonly stored: ReadonlyArray<DossierFindingEntity>
    /** The stored states of the dossiers of the pass. */
    readonly reviews: ReadonlyArray<DossierReviewEntity>
}

/** How the model pass of a run went, counted as it goes. */
export interface ModelTally {
    /** Dossiers whose inputs changed. */
    changed: number
    /** Dossiers the model read. */
    read: number
    /** Calls that failed. */
    failed: number
    /** Calls made. */
    calls: number
    /** Prompt tokens spent. */
    tokens: number
    /** Whether the credits stopped the pass. */
    credits: boolean
    /** Whether a cap stopped the pass. */
    budget: boolean
}

/** What the model pass of a run found. */
interface ModelPass {
    /** The model candidates after the evidence check. */
    readonly kept: Array<FindingCandidate>
    /** Why candidates were dropped. */
    readonly dropped: Array<DropReason>
    /** The fingerprints of open model findings the model resolved. */
    readonly resolved: Set<string>
    /** The new inputs fingerprint of each dossier the model read. */
    readonly fingerprints: Map<string, string>
    /** How it went. */
    readonly tally: ModelTally
}

/** The rank of a severity, critical first; the rules only hand out the four severities. */
const rankOf = (severity: string): number => FINDING_SEVERITIES.findIndex((item) => item === severity)

const clip = (text: string, max: number): string => text.slice(0, max)

/** The AI state of a run from what its model pass did. */
export const stateOf = (tally: ModelTally): AiState => {
    if (tally.changed === 0) return "skipped_unchanged"
    if (tally.read === tally.changed) return "done"
    if (tally.read > 0) return "partial"
    if (tally.credits) return "skipped_credits"
    if (tally.budget) return "skipped_budget"
    return "failed"
}

@Injectable()
/**
 * Carries out a review run: claims it, runs the rules over its dossiers, lets the model read each changed dossier within the credits
 * and the caps, checks every candidate's evidence, reconciles the stored findings and recomputes each dossier's status.
 */
export class DossierReviewRunnerService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectDossierReasoner() private readonly reasoner: DossierReasoner,
        private readonly inputs: ReviewInputsService,
        private readonly usage: UsageMeterService,
        private readonly critic: ReviewCriticService,
    ) {}

    /** Runs the review a job names; a payload of another shape, or a run another worker holds or finished, changes nothing. */
    async run(payload: object): Promise<JobOutcome> {
        if (!isDossierReviewPayload(payload)) {
            this.logger.warn(DossierReviewLogEvent.PayloadRefused, { job: "review" })
            return "skipped"
        }
        const now = this.clock.now()
        const run = await this.claim(payload.workspaceId, payload.runId, now)
        if (run === null) {
            await this.critic.settle(payload.workspaceId, payload.runId)
            return "skipped"
        }
        const pass = await this.passOf(run, now)
        const ai = await this.modelPass(pass)
        const outcome = reconcile({
            runId: run.id,
            now,
            trigger: run.trigger,
            stored: pass.stored.map(toStoredFinding),
            candidates: [...pass.ruleGuard.kept, ...ai.kept].map((candidate) => ({
                candidate,
                fingerprint: fingerprintOf(candidate),
                evidenceHash: evidenceHashOf(candidate.evidence),
            })),
            coverage: new Set(pass.rules.coverage),
            aiResolved: ai.resolved,
        })
        await this.persist(pass, ai, outcome)
        await this.critic.settle(run.workspaceId, run.id)
        return "done"
    }

    /** The job of a run failed for good: the run, while queued or running, ends failed. */
    async fail(payload: object): Promise<void> {
        if (!isDossierReviewPayload(payload)) return
        await this.entityManager.update(
            DossierReviewRunEntity,
            { id: payload.runId, workspaceId: payload.workspaceId, status: In(["queued", "running"]) },
            { status: "failed", finishedAt: this.clock.now(), error: JOB_FAILED },
        )
        await this.critic.settle(payload.workspaceId, payload.runId)
    }

    /** Takes a queued run, or one whose worker has been silent for 15 minutes; null when another worker holds it or it ended. */
    private claim(workspaceId: string, runId: string, now: Date): Promise<DossierReviewRunEntity | null> {
        return this.entityManager.transaction(async (tx) => {
            const row = await tx.findOne(DossierReviewRunEntity, {
                where: { id: runId, workspaceId },
                lock: { mode: "pessimistic_write" },
            })
            if (row === null) return null
            const staleBefore = now.getTime() - DOSSIER_REVIEW_CAPS.staleRunMinutes * 60_000
            const stale = row.status === "running" && (row.startedAt?.getTime() ?? 0) < staleBefore
            if (row.status !== "queued" && !stale) return null
            await tx.update(DossierReviewRunEntity, { id: row.id, workspaceId }, { status: "running", startedAt: now })
            return row
        })
    }

    /** What the run reads: its dossiers with their documents and facts, the rule candidates that verify, the stored findings and states. */
    private async passOf(run: DossierReviewRunEntity, now: Date): Promise<RunPass> {
        const { context, targetIds } = await this.inputs.collect(
            run.workspaceId,
            run.dossierId,
            now.toISOString().slice(0, 10),
        )
        const filed = {
            ...context,
            dossiers: context.dossiers.filter((inputs) => inputs.dossier.id !== UNFILED_DOSSIER_ID),
        }
        const ids = filed.dossiers.map((inputs) => inputs.dossier.id)
        const corpus = corpusOf(context.dossiers)
        const rules = this.unfiledAsNone(runRules(context), run.dossierId === null)
        const where = { workspaceId: run.workspaceId, dossierId: In(ids) }
        return {
            run,
            now,
            context: filed,
            targetIds,
            corpus,
            rules,
            ruleGuard: guardCandidates(
                rules.candidates.map((candidate) => this.rendered(candidate)),
                corpus,
                [],
            ),
            stored: await this.entityManager.find(DossierFindingEntity, {
                where:
                    ids.length === 0
                        ? [{ workspaceId: run.workspaceId, dossierId: IsNull() }]
                        : [where, { workspaceId: run.workspaceId, dossierId: IsNull() }],
                take: STORED_MAX,
            }),
            reviews:
                ids.length === 0 ? [] : await this.entityManager.find(DossierReviewEntity, { where, take: STORED_MAX }),
        }
    }

    /** What the rules found about the documents no dossier claims is filed under no dossier (the stand-in gives way to null), and a whole-set run has covered those findings, so one that is no longer detected resolves. */
    private unfiledAsNone(output: RuleOutput, wholeSet: boolean): RuleOutput {
        return {
            candidates: output.candidates.map((candidate) => ({
                ...candidate,
                dossierId: candidate.dossierId === UNFILED_DOSSIER_ID ? null : candidate.dossierId,
                relatedDossierIds: candidate.relatedDossierIds.filter((id) => id !== UNFILED_DOSSIER_ID),
            })),
            coverage: [
                ...output.coverage.map((key) =>
                    key.endsWith(`|${UNFILED_DOSSIER_ID}`)
                        ? coverageKey(key.slice(0, -UNFILED_DOSSIER_ID.length - 1), null)
                        : key,
                ),
                ...(wholeSet ? RULE_KEYS.map((key) => coverageKey(key, null)) : []),
            ],
        }
    }

    /** A rule candidate with its title and detail in Vietnamese, the language the dossiers are written in. */
    private rendered(candidate: FindingCandidate): FindingCandidate {
        const params = Object.fromEntries(
            Object.entries(candidate.params).map(([key, value]) => [
                key,
                value.includes(UNFILED_DOSSIER_NAME)
                    ? value.replace(UNFILED_DOSSIER_NAME, this.catalog.get("unfiled.label", {}, "vi"))
                    : value,
            ]),
        )
        const text = (field: string, max: number): string =>
            clip(this.catalog.get(["findings", candidate.code, field].join("."), params, "vi"), max)
        return {
            ...candidate,
            title: text("title", DOSSIER_REVIEW_CAPS.titleMax),
            detail: text("detail", DOSSIER_REVIEW_CAPS.detailMax),
        }
    }

    /** The calls the workspace made to the model for reviews in the last 24 hours, counted from its runs. */
    private async dailyCalls(workspaceId: string, now: Date): Promise<number> {
        const row = await this.entityManager
            .createQueryBuilder(DossierReviewRunEntity, "r")
            .select("COALESCE(SUM(CAST(r.stats->>'aiCalls' AS integer)), 0)", "calls")
            .where("r.workspaceId = :workspaceId AND r.createdAt >= :since", {
                workspaceId,
                since: new Date(now.getTime() - DOSSIER_REVIEW_CAPS.dayMs),
            })
            .getRawOne<{ calls: string | number }>()
        return Number(row?.calls ?? 0)
    }

    /**
     * Lets the model read each changed dossier the run targets, the most severe first: an unchanged dossier is skipped, the credits are
     * checked before each call, and the per-run and daily caps stop the pass; a dossier left out keeps its fingerprint, so the next run
     * reads it.
     */
    private async modelPass(pass: RunPass): Promise<ModelPass> {
        const worst = (id: string): number =>
            Math.min(
                FINDING_SEVERITIES.length,
                ...pass.ruleGuard.kept.filter((item) => item.dossierId === id).map((item) => rankOf(item.severity)),
            )
        const targets = pass.context.dossiers
            .filter((inputs) => pass.targetIds.includes(inputs.dossier.id) && inputs.documents.length > 0)
            .sort((a, b) => worst(a.dossier.id) - worst(b.dossier.id) || a.dossier.position - b.dossier.position)
        const result: ModelPass = {
            kept: [],
            dropped: [],
            resolved: new Set(),
            fingerprints: new Map(),
            tally: { changed: 0, read: 0, failed: 0, calls: 0, tokens: 0, credits: false, budget: false },
        }
        const daily = targets.length === 0 ? 0 : await this.dailyCalls(pass.run.workspaceId, pass.now)
        const previous = new Map(pass.reviews.map((review) => [review.dossierId, review.inputsFingerprint]))
        await eachInOrder(targets, async (inputs) => {
            const ownRules = pass.ruleGuard.kept.filter((item) => item.dossierId === inputs.dossier.id)
            const fingerprint = inputsFingerprintOf(inputs, ownRules.map(fingerprintOf))
            if (previous.get(inputs.dossier.id) === fingerprint) return
            const { tally } = result
            tally.changed += 1
            const capped =
                tally.calls >= DOSSIER_REVIEW_CAPS.workspaceCalls ||
                daily + tally.calls >= DOSSIER_REVIEW_CAPS.dailyReviewCalls
            if (capped) tally.budget = true
            if (tally.credits || tally.budget) return
            if (await this.readDossier(pass, inputs, ownRules, result))
                result.fingerprints.set(inputs.dossier.id, fingerprint)
        })
        return result
    }

    /** One model call for one dossier within the token cap and the credits; answers whether the model read it. */
    private async readDossier(
        pass: RunPass,
        inputs: DossierInputs,
        ownRules: ReadonlyArray<FindingCandidate>,
        result: ModelPass,
    ): Promise<boolean> {
        const { tally } = result
        const id = inputs.dossier.id
        const related = pass.context.dossiers.filter((other) => other.dossier.id !== id)
        const own = pass.stored.filter((row) => row.dossierId === id)
        const openAi = own.filter((row) => row.origin === "ai" && (row.status === "open" || row.status === "confirmed"))
        const built = buildBundle({
            workspaceId: pass.run.workspaceId,
            today: pass.context.today,
            inputs,
            related,
            known: [
                ...ownRules.map((item) => ({ kind: item.kind, title: item.title })),
                ...own.filter((row) => !openAi.includes(row)).map((row) => ({ kind: row.kind, title: row.title })),
            ],
            openAi: openAi.map((row) => ({ fingerprint: row.fingerprint, title: row.title, detail: row.detail })),
        })
        const estimate = Math.ceil(built.chars / 4)
        if (tally.tokens + estimate > DOSSIER_REVIEW_CAPS.workspacePromptTokens) {
            tally.budget = true
            return false
        }
        if (await this.usage.blockedBy(pass.run.workspaceId, "brain", pass.run.scope === "workspace")) {
            tally.credits = true
            return false
        }
        tally.calls += 1
        const review = await this.reasoner.review(built.bundle)
        if (review === null) {
            tally.failed += 1
            this.logger.warn(DossierReviewLogEvent.ModelUnavailable, { runId: pass.run.id, dossierId: id })
            return false
        }
        tally.tokens += review.promptTokens ?? estimate
        const known: Array<KnownFinding> = [
            ...ownRules.map((item) => {
                const cited = citedIds(item.evidence)
                return { kind: item.kind, ids: [...cited.sources, ...cited.facts] }
            }),
            ...own.map((row) => ({ kind: row.kind, ids: [...row.sourceIds, ...row.factIds] })),
        ]
        const guarded = guardCandidates(
            reasonedCandidates(review, built, inputs, related, pass.corpus),
            pass.corpus,
            known,
        )
        result.kept.push(...guarded.kept)
        result.dropped.push(...guarded.dropped)
        const changedAt = new Map(
            pass.context.dossiers.flatMap((other) => other.documents.map((doc) => [doc.id, doc.updatedAt] as const)),
        )
        const firstSeen = new Map(openAi.map((row) => [row.fingerprint, row.firstSeenAt.toISOString()]))
        for (const fingerprint of resolvedByModel(review, built, pass.corpus, changedAt, firstSeen)) {
            result.resolved.add(fingerprint)
        }
        tally.read += 1
        return true
    }

    /** Writes what the run decided in one transaction: the new and changed findings, each dossier's state and the run's end. */
    private async persist(pass: RunPass, ai: ModelPass, outcome: Reconciliation): Promise<void> {
        const { run, now, context } = pass
        const ids = context.dossiers.map((inputs) => inputs.dossier.id)
        const dropped = [...pass.ruleGuard.dropped, ...ai.dropped]
        const droppedReasons: Record<string, number> = {}
        for (const reason of dropped) droppedReasons[reason] = (droppedReasons[reason] ?? 0) + 1
        if (dropped.length > 0) {
            this.logger.info(DossierReviewLogEvent.CandidatesDropped, { runId: run.id, reasons: droppedReasons })
        }
        const previous = new Map(pass.reviews.map((review) => [review.dossierId, review.inputsFingerprint]))
        await this.entityManager.transaction(async (tx) => {
            const rows = outcome.inserts.flatMap((item) =>
                toFindingRows(item, { workspaceId: run.workspaceId, runId: run.id, now }),
            )
            if (rows.length > 0) await tx.insert(DossierFindingEntity, rows)
            await eachInOrder(outcome.changes, async (change) => {
                await tx.update(
                    DossierFindingEntity,
                    { id: change.id, workspaceId: run.workspaceId },
                    toFindingUpdate(change.changes),
                )
            })
            if (ids.length > 0) {
                const active = await tx.find(DossierFindingEntity, {
                    select: { id: true, dossierId: true, kind: true, severity: true },
                    where: { workspaceId: run.workspaceId, dossierId: In(ids), status: In(["open", "confirmed"]) },
                    take: STORED_MAX,
                })
                await tx.upsert(
                    DossierReviewEntity,
                    context.dossiers.map((inputs) =>
                        this.reviewRow(
                            pass,
                            inputs,
                            active.filter((finding) => finding.dossierId === inputs.dossier.id),
                            ai.fingerprints.get(inputs.dossier.id) ?? previous.get(inputs.dossier.id) ?? null,
                        ),
                    ),
                    ["dossierId"],
                )
            }
            await tx.update(
                DossierReviewRunEntity,
                { id: run.id, workspaceId: run.workspaceId },
                {
                    status: "done",
                    finishedAt: now,
                    aiState: stateOf(ai.tally),
                    stats: {
                        opened: outcome.opened,
                        resolved: outcome.resolved,
                        dropped: dropped.length,
                        droppedReasons,
                        evaluated: context.dossiers.length,
                        aiCalls: ai.tally.calls,
                        promptTokens: ai.tally.tokens,
                    },
                },
            )
        })
    }

    /** The recomputed state of one dossier after the run. */
    private reviewRow(
        pass: RunPass,
        inputs: DossierInputs,
        active: ReadonlyArray<DossierFindingEntity>,
        inputsFingerprint: string | null,
    ): Partial<DossierReviewEntity> {
        const count = (state: string): number => inputs.documents.filter((doc) => doc.state === state).length
        return {
            workspaceId: pass.run.workspaceId,
            dossierId: inputs.dossier.id,
            status: statusOf({
                requirement: inputs.entry?.requirement ?? null,
                checklistStatus: inputs.dossier.checklistStatus,
                actual: count("actual"),
                drafts: count("draft"),
                active,
            }),
            openCount: active.length,
            criticalCount: active.filter((finding) => finding.severity === "critical").length,
            highCount: active.filter((finding) => finding.severity === "high").length,
            actualDocuments: count("actual"),
            draftDocuments: count("draft"),
            templateDocuments: count("template"),
            inputsFingerprint,
            lastRunId: pass.run.id,
            reviewedAt: pass.now,
        }
    }
}
