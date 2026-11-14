import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import {
  BrainFactEmbeddingsService,
  BrainFactsReadService,
  BrainFactsService,
  factEmbedHashOf,
  factEmbedTextOf,
  needsEmbedding,
  type EmbeddedStatus,
  type EmbeddingIdentity,
  type FactEmbeddingState,
  type FactRecord,
  type FactsChangedHook,
  type MaybeFact,
} from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import { VectorSyncService } from "@modules/domain/vector-sync"
import { EMBEDDING_DIMENSIONS, hasStoredSize } from "@modules/domain/knowledge-chunks"
import { InjectAi, type AiService } from "@modules/integrations/ai"
import { InjectLogger, withWorkStep, type Logger } from "@modules/platform/logging"
import { concurrencyGateOf, eachInOrder } from "@modules/platform/primitives"
import { BrainLogEvent } from "./brain.log-events"
import type {
  Candidates,
  EmbeddingsRefreshed,
  JudgedFact,
  LineBatchEntry,
  LinesEmbedded,
  SameKeyRepeats,
  SameMeaningChecked,
} from "./fact-embeddings.contracts"
import {
  ANNOUNCE_INLINE_MAX,
  EMBED_TIMEOUT_MS,
  JUDGE_BUDGET,
  JUDGE_PARALLEL,
  JUDGE_RETRY_BUDGET,
  JUDGE_TIMEOUT_MS,
  JUDGE_TRIES,
  NOTHING_REFRESHED,
  batchesOf,
  fitsAsCandidate,
  sameKeyRepeatToRead,
  sameTruthActOf,
  type SameTruthAct,
} from "./fact-embeddings.policy"
import { FactReadingLogEvent } from "./fact-reading.log-events"
import { INGESTION_TARGET } from "./ingestion-model.policy"
import { ModelJsonService } from "./model-json.service"
import {
  JUDGE_DISTANCE_CAP,
  JUDGE_VECTOR_CANDIDATES,
  JUDGE_WORD_CANDIDATES,
  SAME_FACT_PROMPT,
  rowsOfOneList,
  sameFactPrompt,
  sameTruthOf,
  type RecheckOutcome,
  type SameTruthVerdict,
} from "./same-fact.policy"

/**
 * The truths a document's new truth is compared with: in force, SCHEDULED for a later start (a dated window that waits is a decided
 * truth: Round W, D-W-2, the same window in a second document was never compared with it) and waiting.
 */
const DOCUMENT_CANDIDATES: ReadonlyArray<EmbeddedStatus> = ["active", "scheduled", "proposed"]

/** The other truth a verdict names for a fact, with what is done about the pair. */
interface Named {
    /** The other truth. */
    readonly other: FactRecord
    /** Join it, or ask the founder. */
    readonly act: Exclude<SameTruthAct, "apart">
}

/**
 * The truth a verdict names among the candidates and what is done (`sameTruthActOf`), or null when nothing is: the judge read them as
 * different truths, or the pair never holds at the same time. An UNKNOWN verdict stands in the nearest candidate that holds at the
 * same time as the fact (never one of another period: that pair is not a question whatever the judge would have said).
 */
const namedBy = (fact: FactRecord, verdict: SameTruthVerdict, candidates: ReadonlyArray<FactRecord>): Named | null => {
    if (verdict.kind === "different") return null
    if (verdict.kind === "same") {
        const other = candidates[verdict.index]
        if (other === undefined) return null
        const act = sameTruthActOf(fact, other, true, verdict.sameValue)
        return act === "apart" ? null : { other, act }
    }
    const other = candidates.find((candidate) => sameTruthActOf(fact, candidate, false, false) === "ask")
    return other === undefined ? null : { other, act: "ask" }
}

@Injectable()
/**
 * Keeps the vectors of the truth graph's facts current, through the ONE embedding door of the AI layer (`AiService.embed` with the
 * configured profile `AiService.embeddingModel()`, metered per workspace as the passages are; WM's `RoutedModels.embeddings(<profile>)`
 * replaces the inside of that door, not this call). A fact whose line has the same hash under the same identity is never embedded
 * again; a fact of another identity is embedded again (the re-index), never compared. Proposals are embedded when a document files them
 * (one batched call per window), so the same fact in other words is found before anything is in force, and approving one sends nothing.
 */
export class FactEmbeddingsService implements OnModuleInit, FactsChangedHook {
    constructor(
        @InjectAi() private readonly ai: AiService,
        @InjectLogger() private readonly logger: Logger,
        private readonly usage: UsageMeterService,
        private readonly vectors: BrainFactEmbeddingsService,
        private readonly facts: BrainFactsService,
        private readonly json: ModelJsonService,
        private readonly reads: BrainFactsReadService,
        @Optional() private readonly sync?: VectorSyncService,
    ) {}

    /** The pinned identity new vectors are made with: the configured profile and the stored column's dimensions. */
    identity(): EmbeddingIdentity {
        return { model: this.ai.embeddingModel(), dimensions: EMBEDDING_DIMENSIONS }
    }

    /** Listens to the facts store: every change of what is in force, whatever door wrote it, gives the changed facts their vectors. */
    onModuleInit(): void {
        this.facts.whenChanged(this)
    }

    /**
     * The facts store's announcement (after the write committed): ONLY the facts it names are looked at (never the whole workspace), and
     * at most `ANNOUNCE_INLINE_MAX` of them are embedded inline (one call, under the embedding timeout), so a fact write never waits on
     * a long batch; the rest are left to the timed sweep, which finds every fact in force with no vector. Never throws and never fails
     * the write.
     */
    async factsChanged(workspaceId: string, changedIds: ReadonlyArray<string>): Promise<void> {
        await this.embedChanged(workspaceId, changedIds)
        await this.follow(workspaceId, changedIds)
    }

    /**
     * Vectors in the vector index: EVERY changed fact gets its `vector.sync` job, not only those in force, so the point of a fact that
     * was superseded, retired, expired or rejected is removed and the point of one whose standing changed is rewritten. Logged, never
     * thrown: the reconcile finds what a lost job left.
     */
    private async follow(workspaceId: string, changedIds: ReadonlyArray<string>): Promise<void> {
        if (this.sync?.bound() !== true) return
        try {
            await this.sync.changed("truth", workspaceId, changedIds)
        } catch (cause) {
            this.logger.error(BrainLogEvent.EmbeddingsFailed, cause, { workspaceId })
        }
    }

    /**
     * Gives the named facts that are in force and lack a current vector one (the copy of the same line first, then one embedding call),
     * the first `ANNOUNCE_INLINE_MAX` of them, read by id in one statement. A failure is logged and the facts stay searchable by words
     * until the sweep; it never throws.
     */
    async embedChanged(workspaceId: string, changedIds: ReadonlyArray<string>): Promise<EmbeddingsRefreshed> {
        try {
            const inline = [...new Set(changedIds)].slice(0, ANNOUNCE_INLINE_MAX)
            if (inline.length === 0 || !this.ai.available()) return NOTHING_REFRESHED
            const states = await this.vectors.statesOf(workspaceId, inline)
            const done = await this.embedLines(
                workspaceId,
                states.filter((state) => state.fact.status === "active"),
            )
            return { embedded: done.embedded, copied: done.copied, unchanged: done.unchanged }
        } catch (cause) {
            this.logger.error(BrainLogEvent.EmbeddingsFailed, cause, { workspaceId })
            return NOTHING_REFRESHED
        }
    }

    /**
     * The one fact IN FORCE of another key, same instance scope, that a new chat proposal replacing nothing by id or key (FX5) says in
     * other words: the candidate a change card shows as "co the thay cho" (may replace). BR1: the vector and the words only pick the
     * candidates (`candidatesOf`: in force only, the judge's bounds); the SAME judgement as a document's check names the one that is the same fact, or
     * none. Before BR1 the nearest vector was taken as the same fact: a change of the outer-city fee was offered as replacing the
     * inner-city fee (0.16 apart), and the founder's approval would have merged it over the wrong truth. Nothing when no candidate is near, when the
     * embedding or brain budget is spent, when the AI is off or answers nothing; never throws.
     */
    async nearestInForce(workspaceId: string, proposal: FactRecord): Promise<MaybeFact> {
        try {
            if (await this.usage.blockedBy(workspaceId, "embedding", false)) return null
            await this.embedLines(workspaceId, await this.vectors.statesOf(workspaceId, [proposal.id]))
            const { facts: candidates } = await this.candidatesOf(workspaceId, proposal, new Set(), ["active"])
            if (candidates.length === 0 || (await this.usage.blockedBy(workspaceId, "brain", false))) return null
            const verdict = await this.judge(workspaceId, proposal, candidates)
            this.logger.info(FactReadingLogEvent.SameMeaningChecked, {
                workspaceId,
                judged: 1,
                flagged: verdict.kind === "different" ? 0 : 1,
                unsure: verdict.kind === "unknown" ? 1 : 0,
            })
            // An unknown verdict is surfaced, never taken as "different": the nearest truth is offered for the founder to confirm.
            if (verdict.kind === "same") return candidates[verdict.index] ?? null
            return verdict.kind === "unknown" ? (candidates[0] ?? null) : null
        } catch (cause) {
            this.logger.error(FactReadingLogEvent.SameMeaningFailed, cause, { workspaceId })
            return null
        }
    }

    /**
     * "The same truth in other words" for the facts one window of a document just filed (new proposals that disagree with nothing),
     * D-BR-3/4/8/9. Each is judged ONCE (one cheap call, at most `JUDGE_TRIES` when an answer is unreadable) against its candidates
     * (`candidatesOf`: the nearest truths by vector plus truths in force sharing its words, the window's own facts excluded: the reading
     * already gives one thing one label inside a window). Three verdicts:
     * - the same truth with the SAME value: a duplicate; its source joins that truth (`mergeDuplicate`: the evidence, and the audience
     *   when it is wider) and nothing is asked;
     * - the same truth with ANOTHER value: a CONTRADICTION, surfaced: flagged `same_meaning` naming the truth (`conflictWith`), for the
     *   founder to choose, keep or split;
     * - different truths: nothing.
     * An answer that never came readable is NOT "different": the fact is flagged with its nearest candidate, a possible duplicate the
     * founder settles. The values are compared in code where they read as one normal form (`sameValue`), else by the judge. Never
     * throws: a failure is logged and the facts stand as filed.
     */
    async checkSameMeaning(workspaceId: string, filed: ReadonlyArray<FactRecord>): Promise<SameMeaningChecked> {
        const open = filed.filter(
            (fact) => fact.status === "proposed" && fact.proposalKind === "set" && fact.conflictWith === null,
        )
        const none: SameMeaningChecked = { judged: 0, flagged: 0, merged: 0, unsure: 0 }
        const repeats = await this.sameKeyRepeats(workspaceId, filed)
        if (open.length === 0) return repeats.judged === 0 ? none : { ...none, ...repeats }
        try {
            if (await this.usage.blockedBy(workspaceId, "embedding", false)) return none
            await this.embedLines(
                workspaceId,
                await this.vectors.statesOf(
                    workspaceId,
                    open.map((fact) => fact.id),
                ),
            )
            const excluded = new Set(filed.map((fact) => fact.id))
            const done = { judged: repeats.judged, flagged: 0, merged: repeats.merged, unsure: 0, unchecked: 0 }
            // The judgements of one window run side by side (TRIAGE-4, effort high: each reasons for seconds); none of them sees another
            // fact of the window (`excluded`), so their answers cannot depend on each other. What they decide is WRITTEN in order, one
            // fact after the other, so two facts never merge into one truth at the same moment.
            const gate = concurrencyGateOf(JUDGE_PARALLEL)
            const judged = await Promise.all(open.map((fact) => gate.run(() => this.judgedOne(workspaceId, fact, excluded))))
            await eachInOrder(judged, async ({ fact, candidates, indexDown, found }) => {
                if (candidates.length === 0) {
                    // The vector index did not answer: "no candidate" says nothing, so the fact is not taken as a distinct truth.
                    if (indexDown) done.unchecked += 1
                    return
                }
                if (found === null) return
                done.judged += 1
                // Judged against the word candidates alone, "different" is not known: it is UNKNOWN, flagged with the nearest for the founder.
                const verdict: SameTruthVerdict = indexDown && found.kind === "different" ? { kind: "unknown" } : found
                const named = namedBy(fact, verdict, candidates)
                if (named === null) return
                if (named.act === "join") {
                    done.merged += await this.closedAsDuplicate(workspaceId, fact, named.other)
                    return
                }
                if (verdict.kind === "unknown") done.unsure += 1
                if (await this.facts.flagSameMeaning(workspaceId, fact.id, named.other.id)) done.flagged += 1
            })
            // `unchecked` is told only when the vector index left a fact unasked.
            const { unchecked, ...counts } = done
            const checked = unchecked > 0 ? done : counts
            this.logger.info(FactReadingLogEvent.SameMeaningChecked, { workspaceId, ...checked })
            return checked
        } catch (cause) {
            this.logger.error(FactReadingLogEvent.SameMeaningFailed, cause, { workspaceId })
            return none
        }
    }

    /**
     * THE SAME KEY, ANOTHER WORDING (owner 2026-11-12: no word list decides that two wordings say one value). A filed truth the store
     * linked to another value of its own key, where code could not prove the values equal and one of them is a wording
     * (`sameKeyRepeatToRead`), has that ONE pair read by the judge (the same call as every same-meaning judgement, `JUDGE_TRIES`): the
     * same truth with the same value is a duplicate and joins it; anything else, an unreadable answer included, leaves the link as
     * the store wrote it (the founder is asked). At most one call per such truth; never throws.
     */
    private async sameKeyRepeats(workspaceId: string, filed: ReadonlyArray<FactRecord>): Promise<SameKeyRepeats> {
        const done = { judged: 0, merged: 0 }
        try {
            const linked = filed.filter(
                (fact) =>
                    fact.status === "proposed" &&
                    fact.proposalKind === "set" &&
                    fact.conflictWith !== null &&
                    !(fact.flags ?? []).includes("same_meaning"),
            )
            if (linked.length === 0) return done
            const others = await this.reads.byIds(workspaceId, [...new Set(linked.flatMap((fact) => fact.conflictWith ?? []))])
            await eachInOrder(linked, async (fact) => {
                const other = others.find((one) => one.id === fact.conflictWith)
                if (other === undefined || !sameKeyRepeatToRead(fact, other)) return
                if (await this.usage.blockedBy(workspaceId, "brain", false)) return
                const verdict = await this.judge(workspaceId, fact, [other])
                done.judged += 1
                if (verdict.kind === "same" && verdict.sameValue) done.merged += await this.closedAsDuplicate(workspaceId, fact, other)
            })
        } catch (cause) {
            this.logger.error(FactReadingLogEvent.SameMeaningFailed, cause, { workspaceId })
        }
        return done
    }

    /** One fact's candidates and judgement (null when the pool is empty: nothing is asked). Writes nothing. */
    private async judgedOne(workspaceId: string, fact: FactRecord, excluded: ReadonlySet<string>): Promise<JudgedFact> {
        const { facts: candidates, indexDown } = await this.candidatesOf(workspaceId, fact, excluded, DOCUMENT_CANDIDATES)
        if (candidates.length === 0) return { fact, candidates, indexDown, found: null }
        if (await this.usage.blockedBy(workspaceId, "brain", false)) return { fact, candidates, indexDown, found: null }
        return { fact, candidates, indexDown, found: await this.judge(workspaceId, fact, candidates) }
    }

    /**
     * The same-meaning check AGAIN, just before a truth of a founder's document goes in force by itself (TRIAGE-2, O-duplicate): its
     * check at filing time saw only what existed then, so a truth that another document put in force BETWEEN its filing and its settle
     * (several documents uploaded together and read in parallel, or a vector not written yet) was never compared with it, and both went
     * in force as two truths. Only those truths are candidates (decided after this one was filed; another key; the same instance), so
     * a settle with nothing new in force makes no call. `duplicate`: the same truth with the same value stands, this one joined it
     * (closed, its source added there); `flagged`: the same truth with another value, or an answer that never came readable, is flagged
     * for the founder (`asked`); `clear`: nothing new says it. Never throws: a failure is `clear` (the settle goes on as before).
     */
    async recheckBeforeForce(workspaceId: string, fact: FactRecord, own: ReadonlySet<string> = new Set()): Promise<RecheckOutcome> {
        try {
            if (fact.conflictWith !== null || fact.proposalKind !== "set") return "clear"
            if (await this.usage.blockedBy(workspaceId, "brain", false)) return "clear"
            const filed = Date.parse(fact.proposedAt)
            // Truths its filing-time check could not see: put in force since, or filed since by ANOTHER document (a document read in
            // parallel that filed after this one is among these). Never the document's own.
            const read = await this.candidatesOf(workspaceId, fact, own, DOCUMENT_CANDIDATES)
            const fresh = read.facts.filter((other) =>
                other.status === "proposed" ? Date.parse(other.proposedAt) > filed : other.decidedAt !== null && Date.parse(other.decidedAt) > filed,
            )
            if (fresh.length === 0) return "clear"
            const verdict = await this.judge(workspaceId, fact, fresh)
            this.logger.info(FactReadingLogEvent.SameMeaningChecked, {
                workspaceId,
                judged: 1,
                flagged: verdict.kind === "different" ? 0 : 1,
                unsure: verdict.kind === "unknown" ? 1 : 0,
            })
            const named = namedBy(fact, verdict, fresh)
            if (named === null) return "clear"
            if (named.act === "join") {
                if ((await this.closedAsDuplicate(workspaceId, fact, named.other)) === 1) return "duplicate"
                return "clear"
            }
            return (await this.facts.flagSameMeaning(workspaceId, fact.id, named.other.id)) ? "flagged" : "clear"
        } catch (cause) {
            this.logger.error(FactReadingLogEvent.SameMeaningFailed, cause, { workspaceId })
            return "clear"
        }
    }

    /**
     * Closes a truth judged the same truth with the same value as a duplicate of the other; answers 1 when it was closed. Two rows of
     * one list (same passage, other lines, other subjects) are two truths and are never closed (`rowsOfOneList`).
     */
    private async closedAsDuplicate(workspaceId: string, fact: FactRecord, other: FactRecord): Promise<number> {
        if (rowsOfOneList(fact, other)) return 0
        return (await this.facts.mergeDuplicate(workspaceId, fact.id, other.id)) === null ? 0 : 1
    }

    /**
     * The truths one new truth is judged against (D-BR-8/9): its `JUDGE_VECTOR_CANDIDATES` nearest truths by vector in these statuses,
     * bounded only by `JUDGE_DISTANCE_CAP` (the ONE vector read, `BrainFactEmbeddingsService.nearestTo`: "nearest facts to this one,
     * same workspace and instance scope, limit N"), then up to `JUDGE_WORD_CANDIDATES` truths in force (or scheduled, when the statuses
     * ask for them) sharing its subject or attribute
     * words (the folded-word index of migration 20261112015200, `BrainFactsReadService.wordHits`), each once. Never the fact's own key
     * (the key already joins them), a retire proposal nor an excluded fact (`fitsAsCandidate`, structure only). Labels naming other
     * numbers (size 10 vs size 20) are SHOWN: whether they are another thing is the judge's reading, never a code filter.
     */
    private async candidatesOf(
        workspaceId: string,
        fact: FactRecord,
        excluded: ReadonlySet<string>,
        statuses: ReadonlyArray<EmbeddedStatus>,
    ): Promise<Candidates> {
        const read = await this.vectors.nearestToRead(workspaceId, fact.id, this.identity(), {
            statuses,
            installationId: fact.installationId,
            maxDistance: JUDGE_DISTANCE_CAP,
            // A few more than wanted: the same key and the excluded ones are dropped after the read.
            limit: JUDGE_VECTOR_CANDIDATES + excluded.size + 3,
        })
        const byVector = read.facts
            .map((hit) => hit.fact)
            .filter((other) => fitsAsCandidate(fact, other, excluded))
            .slice(0, JUDGE_VECTOR_CANDIDATES)
        const taken = new Set(byVector.map((other) => other.id))
        // The word leg offers decided truths only (in force, and scheduled when asked for): a waiting line is found by its vector.
        const decided = new Set<string>(statuses.filter((status) => status !== "proposed"))
        const words = await this.reads.wordHits(
            workspaceId,
            "internal",
            "",
            fact.installationId,
            `${fact.subjectLabel} ${fact.attributeLabel}`,
        )
        const byWords = words
            .filter((other) => decided.has(other.status) && !taken.has(other.id) && fitsAsCandidate(fact, other, excluded))
            .slice(0, JUDGE_WORD_CANDIDATES)
        if (read.indexDown) this.logger.warn(FactReadingLogEvent.SameMeaningIndexDown, { workspaceId, factId: fact.id })
        return { facts: [...byVector, ...byWords], indexDown: read.indexDown }
    }

    /**
     * Asks the model whether a fact states the same truth as one of its candidates (D-BR-3). The budget leaves room for the reasoning
     * the model spends before its few-token answer (`JUDGE_BUDGET`); every try is booked as `brain` (an answered one with its usage, a
     * cut or failed one through the same meter with its failure and what it spent), and a try that gave no readable verdict is tried
     * again, at most `JUDGE_TRIES` in all. Still unreadable: `unknown`, never "different".
     */
    private async judge(
        workspaceId: string,
        fact: FactRecord,
        candidates: ReadonlyArray<FactRecord>,
    ): Promise<SameTruthVerdict> {
        const prompt = sameFactPrompt(fact, candidates)
        const promptChars = SAME_FACT_PROMPT.length + prompt.length
        const booked = { workspaceId, kind: "brain" as const, module: "knowledge", promptChars }
        const tryOnce = async (tryNumber: number, afterCut = false): Promise<SameTruthVerdict> => {
            const tried = await this.ai.attempt({
                messages: [
                    { role: "system", content: SAME_FACT_PROMPT, cacheMark: true },
                    { role: "user", content: prompt },
                ],
                json: false,
                schema: null,
                timeoutMs: JUDGE_TIMEOUT_MS,
                budget: afterCut ? JUDGE_RETRY_BUDGET : JUDGE_BUDGET,
                context: null,
                // A same-truth judgement is a decision of meaning: the strong model (owner 2026-11-12, D-R-7 wrong merges on the cheap one).
                target: INGESTION_TARGET,
            })
            if (!tried.ok && tried.failure === "unconfigured") return { kind: "unknown" }
            const verdict = tried.ok ? sameTruthOf(this.json.jsonOf(tried.answer.text, workspaceId), candidates.length) : null
            await this.usage.record(
                tried.ok
                    ? {
                          ...booked,
                          model: tried.answer.model,
                          usage: tried.answer.usage,
                          completionChars: tried.answer.text.length,
                          tryNumber,
                          // Which upstream served it, why it stopped and how long it took (D-R-11: judge rows carried none).
                          served: tried.answer.served,
                      }
                    : {
                          ...booked,
                          model: tried.spent?.model ?? this.ai.chatModel(),
                          usage: tried.spent?.usage ?? null,
                          failure: tried.failure,
                          tryNumber,
                          served: tried.spent?.served,
                      },
            )
            if (verdict !== null && verdict.kind !== "unknown") return verdict
            // A verdict cut at its cap (the finish reason says so; it is never parsed) is asked again with more room.
            const cut = !tried.ok && tried.failure === "length"
            return tryNumber < JUDGE_TRIES ? tryOnce(tryNumber + 1, cut) : { kind: "unknown" }
        }
        // Booked as the `judge` step of the work in scope (a document's reading, or the change door's own work).
        return withWorkStep("judge", "brain_judge", () => tryOnce(1))
    }

    /**
     * Gives the facts among these whose stored vector is not current one: the vector of the same line another row holds is copied
     * (`adopt`, no call), the rest are embedded in batches of `EMBED_BATCH` lines, one batch after the other, and each batch's vectors
     * are stored in one write. `stopped` when a call answered nothing or the wrong shape: the batches after it are not sent. The one
     * embedding loop of the truth graph: the announcement, the same-meaning check and the timed sweep all come through it.
     */
    async embedLines(workspaceId: string, states: ReadonlyArray<FactEmbeddingState>): Promise<LinesEmbedded> {
        const identity = this.identity()
        const stale = states
            .map((state) => ({ state, hash: factEmbedHashOf(state.fact) }))
            .filter(({ state, hash }) => needsEmbedding(state.stored, hash, identity))
        const unchanged = states.length - stale.length
        const copied =
            stale.length === 0
                ? new Set<string>()
                : await this.adoptLines(
                      workspaceId,
                      stale.map(({ state, hash }) => ({ id: state.fact.id, hash })),
                      identity,
                  )
        const run = { embedded: 0, stopped: false }
        await eachInOrder(batchesOf(stale.filter(({ state }) => !copied.has(state.fact.id))), async (batch) => {
            if (run.stopped) return
            const written = await this.embedBatch(workspaceId, batch, identity)
            if (written === null) run.stopped = true
            else run.embedded += written
        })
        return { embedded: run.embedded, copied: copied.size, unchanged, stopped: run.stopped }
    }

    /**
     * Embeds one batch of lines in one call, meters it (as the `index` step of the work in scope) and stores its vectors in one write;
     * null when the call gave nothing usable, or the credit pool is empty (checked before EVERY call: the batches after it wait).
     */
    private embedBatch(
        workspaceId: string,
        batch: ReadonlyArray<LineBatchEntry>,
        identity: EmbeddingIdentity,
    ): Promise<number | null> {
        return withWorkStep("index", "fact_vectors", () => this.embedBatchNow(workspaceId, batch, identity))
    }

    private async embedBatchNow(
        workspaceId: string,
        batch: ReadonlyArray<LineBatchEntry>,
        identity: EmbeddingIdentity,
    ): Promise<number | null> {
        if (await this.usage.blockedBy(workspaceId, "embedding", true)) return null
        const texts = batch.map(({ state }) => factEmbedTextOf(state.fact))
        const answer = await this.ai.embed({
            input: texts,
            dimensions: identity.dimensions,
            timeoutMs: EMBED_TIMEOUT_MS,
        })
        if (answer === null || !hasStoredSize(answer.vectors, texts.length)) return null
        await this.usage.record({
            workspaceId,
            kind: "embedding",
            module: "knowledge",
            model: identity.model,
            usage: answer.usage,
            promptChars: texts.reduce((sum, text) => sum + text.length, 0),
        })
        const vectors = answer.vectors
        const written = batch.flatMap(({ state, hash }, index) => {
            const vector = vectors[index]
            return vector === undefined ? [] : [{ id: state.fact.id, hash, vector }]
        })
        await this.storeLines(workspaceId, written, identity)
        return written.length
    }

    /**
     * THE STORE SWITCH of the truths' vectors, adoption half. Vectors in the vector index (`VectorSyncService.bound`): a line another
     * row's point already holds takes that point's vector (one index read, no embedding call, nothing booked). Otherwise the pgvector
     * copy in the database.
     */
    private adoptLines(
        workspaceId: string,
        wanted: ReadonlyArray<{ readonly id: string; readonly hash: string }>,
        identity: EmbeddingIdentity,
    ): Promise<ReadonlySet<string>> {
        return this.sync?.bound() === true
            ? this.sync.adopt(
                  "truth",
                  workspaceId,
                  wanted.map((one) => one.id),
              )
            : this.vectors.adopt(workspaceId, wanted, identity)
    }

    /**
     * THE STORE SWITCH, write half. Vectors in the vector index: the fresh vectors are handed to the sync (the `vector.sync` job of
     * the facts is written first, then the points; Postgres records the identity, the hash and `indexed_at` once the index accepted
     * them) and Postgres keeps no vector. Otherwise the pgvector column.
     */
    private async storeLines(
        workspaceId: string,
        written: ReadonlyArray<{ readonly id: string; readonly hash: string; readonly vector: ReadonlyArray<number> }>,
        identity: EmbeddingIdentity,
    ): Promise<void> {
        if (this.sync?.bound() === true) {
            await this.sync.accept("truth", workspaceId, new Map(written.map((one) => [one.id, one.vector])))
            return
        }
        await this.vectors.storeMany(workspaceId, written, identity)
    }
}
