import { Injectable } from "@nestjs/common"
import { BrainFactsReadService } from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import { DERIVE_EFFORT, InjectAi, spendOf, type AiBudget, type AiService } from "@modules/integrations/ai"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectLogger, withWorkScope, type Logger } from "@modules/platform/logging"
import { isPolicyDerivePayload } from "@modules/queues/knowledge"
import { BrainPolicyCandidatesService, type TruthKey } from "./brain-policy-candidates.service"
import { BrainPolicyDerivationsService } from "./brain-policy-derivations.service"
import { BrainPolicyStoreService, type JudgedFact } from "./brain-policy-store.service"
import { BrainError, BrainErrorCode } from "./errors/brain.error"
import { ModelJsonService } from "./model-json.service"
import { PolicyDeriveLogEvent } from "./policy-derive.log-events"
import {
  DERIVE_BATCH,
  DERIVE_MAX_CALLS,
  DERIVE_SYSTEM,
  deriveBatchesOf,
  derivePlanOf,
  derivePrompt,
  heldByTruth,
  judgementsOf,
  type DeriveAsk,
} from "./policy-derive.policy"

/** The candidate truths one page reads (keyset by truth key): three statements per page whatever the size of the workspace. */
export const DERIVE_PAGE = 200

/** The most pages one pass reads (a job bound, never a quota): a workspace with more candidates goes on in a follow-up pass. */
export const DERIVE_PAGES_PER_PASS = 25

/** The most orphaned judgements one pass retires; the rest are retired by the follow-up pass. */
const RETIRE_PER_PASS = 1000

/** The most groups in use the prompt lists (the policy's own bound). */
const GROUPS_MAX = 30

/** An AI failure gets three tries in total (owner rule for every AI call), then the pass is given up and the tab says so. */
const MAX_ATTEMPTS = 3

/** How long the model may take to judge one batch. */
const BATCH_TIMEOUT_MS = 45_000

/**
 * What judging one batch may spend: no reasoning asked, and at most this many completion tokens, hidden reasoning INCLUDED (D-BR-2). The
 * `work` profile is Claude on the Anthropic protocol, where the app sends no reasoning field (`ai.client.ts` sends `reasoning` only to an
 * OpenAI-compatible upstream), so the model's own default thinking is spent and counted in the cap: the cap is sized for it (12 facts of
 * about 150 tokens each = ~1,800, cap 4,000), and a cut answer is halved, never retried whole.
 */
const DERIVE_BUDGET: AiBudget = { effort: DERIVE_EFFORT, maxTokens: 4000 }

/** The work kind every call of a pass is booked under in `ai_usage_events`; the step key says first derive or re-derive. */
export const POLICY_DERIVE_WORK = "policy_derive"

/**
 * How a pass ended: `done` (nothing left to judge), `more` (the bound was reached: a follow-up pass is queued), `blocked` (no credits),
 * `failed` (given up after three tries, or no AI endpoint) or `skipped` (a payload of another shape).
 */
export type PolicyDeriveOutcome = "done" | "more" | "blocked" | "failed" | "skipped"

/** What one pass did. */
export interface PolicyDerivePass {
    /** How it ended. */
    readonly outcome: PolicyDeriveOutcome
    /** Facts the model judged (added or amended). */
    readonly judged: number
    /** Judgements that followed their truth to its new value with no model call. */
    readonly rebound: number
    /** Judgements retired because nothing holds their truth. */
    readonly retired: number
    /** Model calls made. */
    readonly calls: number
}

/** The candidates one pass read: the asks for the model, the judgements re-bound, and whether no candidate was left unread. */
interface CandidatesRead {
    readonly ask: ReadonlyArray<DeriveAsk>
    readonly rebound: number
    readonly exhausted: boolean
}

/** What judging the batches of one pass did: the facts judged, the calls made, and whether the credit pool stopped it. */
interface JudgedRun {
    readonly count: number
    readonly calls: number
    readonly blocked: boolean
}

@Injectable()
/**
 * The derive pass of the policy layer (owner, 2026-11-11: an AI derives the shop's policies from the truth graph, and compares each
 * change of the graph to add or amend them). ONE pass serves the first derive, every re-derive and the backfill: it compares the
 * facts that hold each truth with the judgements stored and only the truths that are new, or whose labels or value kind changed, go
 * to the model; a new value of a judged truth re-binds and a truth nothing holds is retired, both without a model call. So a pass
 * over its own result does nothing, and running it twice is safe. It never reads every fact (BRAIN-LIMITS item 3): it pages, by truth
 * key, over the truths that need a look only (no judgement, or a judgement not bound to the fact that holds the truth now), selected in
 * SQL (`BrainPolicyCandidatesService`), three statements a page; a settled truth is never read again. Bounded: `DERIVE_BATCH` facts a
 * call, `DERIVE_MAX_CALLS` calls planned a pass, `DERIVE_PAGES_PER_PASS` pages a pass, the answer capped; a larger workspace continues in
 * a follow-up job. The credit pool is checked before EVERY model call. An answer cut at the cap is booked with what it spent and its batch
 * is HALVED and judged again (a pass always converges; a single fact whose answer is still cut is left for the next pass), and what earlier
 * batches judged is kept whatever a later batch does (D-BR-2 (c), (d)). Every call goes through the AI layer's routed chat (`AiService.chat`, the app's
 * chat profile, as the brain's other readings do) and is booked under the usage kind `brain`, work kind `policy_derive`.
 */
export class BrainPolicyDeriveService {
    constructor(
        @InjectAi() private readonly ai: AiService,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly reads: BrainFactsReadService,
        private readonly store: BrainPolicyStoreService,
        private readonly candidates: BrainPolicyCandidatesService,
        private readonly derivations: BrainPolicyDerivationsService,
        private readonly usage: UsageMeterService,
        private readonly json: ModelJsonService,
    ) {}

    /** Runs the pass a derive job names; a payload of another shape is logged and dropped. */
    async run(payload: object): Promise<PolicyDeriveOutcome> {
        if (!isPolicyDerivePayload(payload)) {
            this.logger.warn(PolicyDeriveLogEvent.PayloadRefused, { job: "policies" })
            return "skipped"
        }
        return (await this.pass(payload.workspaceId)).outcome
    }

    /** The job ended as failed (the queue's retries ran out): the state says so, for the tab. */
    async giveUp(payload: object): Promise<void> {
        if (!isPolicyDerivePayload(payload)) return
        await this.derivations.failed(payload.workspaceId, "gave_up")
        this.logger.error(PolicyDeriveLogEvent.GaveUp, new BrainError({ code: BrainErrorCode.ModelUnavailable }), {
            workspaceId: payload.workspaceId,
        })
    }

    /**
     * One pass over a workspace. Throws `BRAIN_MODEL_UNAVAILABLE` when the model gave no usable answer and tries are left: the queue
     * runs the job again; what earlier batches of the pass stored is kept. Retires the judgements nothing holds, then pages over the
     * candidate truths only: each page re-binds what follows its truth with no model call and collects what the model must judge, until a
     * pass's worth of asks (`DERIVE_BATCH` x `DERIVE_MAX_CALLS`) or `DERIVE_PAGES_PER_PASS` pages; then it judges.
     */
    async pass(workspaceId: string): Promise<PolicyDerivePass> {
        const { startedAt, attempts } = await this.derivations.started(workspaceId)
        const orphaned = await this.store.orphaned(workspaceId, RETIRE_PER_PASS)
        await this.store.retire(workspaceId, orphaned)
        const read = await this.candidatesOf(workspaceId)
        const moved = { rebound: read.rebound, retired: orphaned.length }
        // More to look at after this pass: a page bound reached, or as many orphans as one pass retires.
        const more = !read.exhausted || orphaned.length >= RETIRE_PER_PASS
        if (read.ask.length === 0) {
            if (more) {
                await this.derivations.more(workspaceId)
                return this.ended(workspaceId, { outcome: "more", judged: 0, calls: 0, ...moved })
            }
            await this.derivations.finished(workspaceId, startedAt)
            return this.ended(workspaceId, { outcome: "done", judged: 0, calls: 0, ...moved })
        }
        if (!this.ai.available()) {
            await this.derivations.failed(workspaceId, "model")
            return this.ended(workspaceId, { outcome: "failed", judged: 0, calls: 0, ...moved })
        }
        if (await this.usage.blockedBy(workspaceId, "brain", true)) {
            await this.derivations.failed(workspaceId, "credits")
            return this.ended(workspaceId, { outcome: "blocked", judged: 0, calls: 0, ...moved })
        }
        const batches = deriveBatchesOf(read.ask)
        const [groups, judgedBefore] = await Promise.all([
            this.store.groupsInUse(workspaceId, GROUPS_MAX),
            this.store.hasAny(workspaceId),
        ])
        // Booked to the workspace's policy layer: the first derive of a workspace, or the comparison of a change.
        const stepKey = judgedBefore ? "rederive" : "derive"
        const judged = await withWorkScope({ kind: POLICY_DERIVE_WORK, ref: `workspace:${workspaceId}`, stepKey }, () =>
            this.judgeAll(workspaceId, batches, groups),
        )
        if (judged.count === 0) {
            if (judged.blocked) {
                await this.derivations.failed(workspaceId, "credits")
                return this.ended(workspaceId, { outcome: "blocked", judged: 0, calls: judged.calls, ...moved })
            }
            // No batch gave one usable judgement: a failed try, never a silent end.
            const tries = attempts + 1
            this.logger.warn(PolicyDeriveLogEvent.BatchFailed, { workspaceId, tries })
            if (tries >= MAX_ATTEMPTS) {
                await this.derivations.failed(workspaceId, "model", tries)
                this.logger.error(
                    PolicyDeriveLogEvent.GaveUp,
                    new BrainError({ code: BrainErrorCode.ModelUnavailable }),
                    {
                        workspaceId,
                    },
                )
                return this.ended(workspaceId, { outcome: "failed", judged: 0, calls: judged.calls, ...moved })
            }
            await this.derivations.retrying(workspaceId, tries)
            throw new BrainError({ code: BrainErrorCode.ModelUnavailable })
        }
        if (judged.count < read.ask.length || more) {
            await this.derivations.more(workspaceId)
            return this.ended(workspaceId, { outcome: "more", judged: judged.count, calls: judged.calls, ...moved })
        }
        await this.derivations.finished(workspaceId, startedAt)
        return this.ended(workspaceId, { outcome: "done", judged: judged.count, calls: judged.calls, ...moved })
    }

    /**
     * The candidate truths of one pass, page by page (keyset by truth key, three statements a page): each page's facts that hold the
     * truths and their judgements are planned together; a re-bind is written at once (no model call); the asks are kept for the model.
     * Stops at a pass's worth of asks or `DERIVE_PAGES_PER_PASS` pages; `exhausted` says no candidate was left unread.
     */
    private candidatesOf(workspaceId: string): Promise<CandidatesRead> {
        return this.pageFrom(workspaceId, null, 0, { ask: [], rebound: 0, exhausted: false })
    }

    /** One candidate page after `after`, planned and re-bound, then the next page while the pass's bounds allow (keyset order). */
    private async pageFrom(
        workspaceId: string,
        after: TruthKey | null,
        pages: number,
        read: CandidatesRead,
    ): Promise<CandidatesRead> {
        if (pages >= DERIVE_PAGES_PER_PASS || read.ask.length >= DERIVE_BATCH * DERIVE_MAX_CALLS) return read
        const page = await this.candidates.page(workspaceId, after, DERIVE_PAGE)
        if (page.keys.length === 0) return { ...read, exhausted: true }
        const [facts, stored] = await Promise.all([
            this.reads.byIds(workspaceId, page.factIds),
            this.store.ofTruths(workspaceId, page.keys),
        ])
        const plan = derivePlanOf(heldByTruth(facts, this.clock.now().getTime()), stored)
        // A re-bind is written before the next page reads the candidates again.
        await this.store.rebind(workspaceId, plan.rebind)
        const next = { ask: [...read.ask, ...plan.ask], rebound: read.rebound + plan.rebind.length, exhausted: false }
        if (page.keys.length < DERIVE_PAGE) return { ...next, exhausted: true }
        return this.pageFrom(workspaceId, page.last, pages + 1, next)
    }

    /**
     * Judges the batches one after the other, each with the groups the ones before added; the credit pool is checked before EVERY call
     * after the first (the pass checked it before the first). A batch cut at the token cap is split in two halves judged next; a single
     * fact still cut is left unjudged (the pass then says `more`). Stops at the first batch the model does not answer at all (the rest
     * waits for the next try) or when the pool is empty. Answers the facts judged, the calls made, and whether the pool stopped it.
     */
    private judgeAll(
        workspaceId: string,
        batches: ReadonlyArray<ReadonlyArray<DeriveAsk>>,
        groups: ReadonlyArray<string>,
    ): Promise<JudgedRun> {
        return this.judgeNext(workspaceId, batches, groups, { count: 0, calls: 0, blocked: false })
    }

    /** The first batch of the queue, then the rest (a cut batch's halves first). */
    private async judgeNext(
        workspaceId: string,
        queue: ReadonlyArray<ReadonlyArray<DeriveAsk>>,
        groups: ReadonlyArray<string>,
        run: JudgedRun,
    ): Promise<JudgedRun> {
        const [batch, ...rest] = queue
        if (batch === undefined) return run
        if (run.calls > 0 && (await this.usage.blockedBy(workspaceId, "brain", true))) return { ...run, blocked: true }
        const found = await this.ask(workspaceId, batch, groups)
        const called = { ...run, calls: run.calls + 1 }
        if (found === "cut") {
            if (batch.length === 1) this.logger.warn(PolicyDeriveLogEvent.BatchCut, { workspaceId, facts: 1 })
            const half = Math.ceil(batch.length / 2)
            const halves = batch.length > 1 ? [batch.slice(0, half), batch.slice(half)] : []
            return this.judgeNext(workspaceId, [...halves, ...rest], groups, called)
        }
        // The model stopped answering: the rest of the pass waits for the next try rather than spending more calls.
        if (found === null) return called
        const judged = await this.store.save(workspaceId, found)
        const added = found.filter((one) => one.judgement.policy).map((one) => one.judgement.group)
        return this.judgeNext(workspaceId, rest, [...new Set([...groups, ...added])], {
            ...called,
            count: called.count + judged,
        })
    }

    /**
     * One model call over one batch: the judgements it gave, `cut` when the answer was cut at the token cap (booked with what it spent:
     * a call that returned tokens is ALWAYS booked, D-BR-15), or null when it did not answer. Metered as `brain`.
     */
    private async ask(
        workspaceId: string,
        batch: ReadonlyArray<DeriveAsk>,
        groups: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<JudgedFact> | "cut" | null> {
        const prompt = derivePrompt(batch, groups)
        const tried = await this.ai.attempt({
            messages: [
                { role: "system", content: DERIVE_SYSTEM },
                { role: "user", content: prompt },
            ],
            json: false,
            schema: null,
            timeoutMs: BATCH_TIMEOUT_MS,
            budget: DERIVE_BUDGET,
            context: null,
            affinity: workspaceId,
        })
        const spend = spendOf(tried)
        if (spend !== null) {
            await this.usage.record({
                workspaceId,
                kind: "brain",
                module: "knowledge",
                promptChars: DERIVE_SYSTEM.length + prompt.length,
                ...spend,
            })
        }
        if (!tried.ok) {
            if (tried.failure !== "length") return null
            this.logger.warn(PolicyDeriveLogEvent.BatchCut, { workspaceId, facts: batch.length })
            return "cut"
        }
        const answer = tried.answer
        const judgements = judgementsOf(this.json.jsonOf(answer.text, workspaceId), batch.length)
        return batch.flatMap((asked, index) => {
            const judgement = judgements.get(index)
            return judgement === undefined ? [] : [{ ...asked, judgement, model: answer.model }]
        })
    }

    /** Logs how a pass ended and answers it. */
    private ended(workspaceId: string, pass: PolicyDerivePass): PolicyDerivePass {
        this.logger.info(PolicyDeriveLogEvent.PassEnded, { workspaceId, ...pass })
        return pass
    }
}
