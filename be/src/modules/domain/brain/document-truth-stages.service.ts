import { Injectable } from "@nestjs/common"
import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { BrainExtractionsService, ExtractionNote, type AnswerNoteReason, type ExtractionStatus } from "@modules/domain/brain-extractions"
import { BrainFactsService, foldedText, type FactRecord } from "@modules/domain/brain-facts"
import { KnowledgeChunksService, type PassageVerdict, type TriageVerdict, type TruthPassage } from "@modules/domain/knowledge-chunks"
import { UsageMeterService } from "@modules/domain/knowledge"
import { StoredNote, type SourceRecord } from "@modules/domain/knowledge-sources"
import { InjectAi, spendOf, type AiChatAttempt, type AiService } from "@modules/integrations/ai"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectLogger, withWorkStep, type Logger } from "@modules/platform/logging"
import { concurrencyGateOf, eachInOrder } from "@modules/platform/primitives"
import { BrainLogEvent } from "./brain.log-events"
import { batchesOf, type StageEnd, type StageInput, type StageResult } from "./document-truths.contracts"
import {
  CALLS_PER_JOB,
  DOCUMENT_DATE_PROMPT,
  PASSAGES_PER_CALL,
  SKIPPED_VERSION,
  SYSTEM_PROMPT,
  TRUTHS_VERSION,
  dateLinesOf,
  datedFactOf,
  documentDatePrompt,
  followUpOf,
  languageOf,
  needsTruths,
  numberedLinesOf,
  parseDocumentDate,
  parseFacts,
  userPrompt,
  type DocumentDate,
  type ExtractedFact,
  type ParsedFacts,
  type ReadPassage,
} from "./extraction.policy"
import { FactEmbeddingsService } from "./fact-embeddings.service"
import { FactReadingLogEvent } from "./fact-reading.log-events"
import { INGESTION_TARGET } from "./ingestion-model.policy"
import { ModelJsonService } from "./model-json.service"
import { INHERITED_VERSION, inheritedOf } from "./document-nature.policy"
import {
  ANSWERS_APART,
  CALL_TIMEOUT_MS,
  FOLLOW_UP_ANSWER_MAX,
  MAX_ATTEMPTS,
  MODEL_PLACES,
  DATE_BUDGET,
  TRUTHS_BUDGET,
  afterTriage,
  afterWindow,
  filingFailedTextOf,
  givenWithoutCall,
  judgedPassages,
  listedOf,
  passagesForModel,
  proposalOf,
  triageBudgetOf,
  unaccountedTextOf,
} from "./document-truth-stages.policy"
import { DocumentNatureService } from "./document-nature.service"
import {
    CODE_VERSION,
    TRIAGE_BATCH,
    TRIAGE_CALLS_PER_JOB,
    TRIAGE_PROMPT,
    TRIAGE_SCHEMA,
    TRIAGE_VERSION,
    parseTriage,
    triagePrompt,
} from "./passage-triage.policy"
import {
  cutOf,
  followUpFor,
  readsBetter,
  splitAt,
  wroteNothingUsable,
  type Ask,
  type CallFiled,
  type Ended,
  type Run,
  type Step,
  type WindowRead,
} from "./truth-window.policy"

@Injectable()
/**
 * The two model stages of a document's truths work. TRIAGE: which passages state a rule of the shop (tables of records, the description
 * of one coded item are judged by the code for no tokens; the others twelve to a call whose answer is a
 * few numbers). EXTRACT: the truths of the rule passages only, four passages to a call, one compact line per truth, each filed as a
 * PROPOSAL naming its passage. Each stage works the passages that still need it, so a retry or a follow-up job goes on where the last
 * one stopped; every call is checked against the credit pool first and booked as `brain`; a job makes a bounded number of calls and says
 * when it stopped. A call whose answer cannot be used is never asked again unchanged: a cut or unreadable triage batch is split in two;
 * an unreadable truth answer is asked once more with its own answer in front of it, then its window is skipped (recorded, read again by
 * the next reading), never the end of the part. Only a call the model did not answer at all is retried as it was, by the queue.
 */
export class DocumentTruthStagesService {
    private readonly modelGate = concurrencyGateOf(MODEL_PLACES)

    constructor(
        @InjectAi() private readonly ai: AiService,
        @InjectLogger() private readonly logger: Logger,
        @InjectClock() private readonly clock: Clock,
        private readonly facts: BrainFactsService,
        private readonly extractions: BrainExtractionsService,
        private readonly chunks: KnowledgeChunksService,
        private readonly usage: UsageMeterService,
        private readonly json: ModelJsonService,
        private readonly vectors: FactEmbeddingsService,
        private readonly nature: DocumentNatureService,
        private readonly zones: WorkspaceTimeZoneService,
    ) {}

    /**
     * Stage 1: what the document IS is judged once (`DocumentNatureService`: one call per text version, the founder's answer over it),
     * and every passage takes the verdict it inherits (`inheritedOf`): records, logs and reference are judged with no passage call and
     * file no truth; only rule material is triaged passage by passage by the model. A passage that LEAVES rule material (the founder
     * said the document holds no rules, or a new reading says so) no longer supports the truths read from it (`withdrawLeft`).
     */
    async triage(input: StageInput): Promise<StageResult> {
        const { source, passages, state } = input
        const counts = { passagesTotal: passages.length }
        const base: Run = { source, stage: "triage", batches: [], counts, before: null, judged: 0 }
        const start: Step = { index: 0, calls: 0, state, verdicts: new Map(), read: new Set() }
        const judged = await this.nature.natureFor(source, passages, state.hash)
        if (judged.kind === "blocked") {
            await this.save(base, start, "blocked_credits", StoredNote.NoCreditsForFacts)
            return { ...this.ended("blocked", base, start), passages }
        }
        if (judged.kind === "retry") return { ...(await this.failed(base, start, true)), passages }
        const inherited = inheritedOf(passages, judged.nature)
        const given = givenWithoutCall(passages, inherited)
        const toModel = passagesForModel(passages, inherited, given)
        if (given.code.size > 0) await this.chunks.setTriage(source.workspaceId, listedOf(given.code), CODE_VERSION)
        if (given.inherited.size > 0) await this.chunks.setTriage(source.workspaceId, listedOf(given.inherited), INHERITED_VERSION)
        await this.withdrawLeft(source, passages, given.inherited)
        const run: Run = { ...base, batches: batchesOf(toModel, TRIAGE_BATCH), judged: passages.length - toModel.length }
        const verdicts = new Map([...given.code, ...given.inherited])
        const ended = await this.triageFrom(run, { ...start, calls: judged.calls, verdicts })
        return { ...ended, passages: judgedPassages(passages, ended.step.verdicts) }
    }

    /**
     * The truths of passages that were rule material and are not any more (their new verdict is data or none) lose those passages as
     * evidence: a proposal resting on them alone is withdrawn, a truth in force left with no evidence becomes a proposal to retire for
     * the founder (`finalizeOrphans`). Logged, never thrown: the triage goes on.
     */
    private async withdrawLeft(
        source: SourceRecord,
        passages: ReadonlyArray<TruthPassage>,
        verdicts: ReadonlyMap<string, TriageVerdict>,
    ): Promise<void> {
        const left = new Set(
            passages.filter((passage) => passage.triage === "rule" && verdicts.has(passage.id)).map((passage) => passage.id),
        )
        if (left.size === 0) return
        try {
            const kept = passages.filter((passage) => !left.has(passage.id))
            const gone = await this.facts.withdrawChanged(source.workspaceId, source.id, "not rule material", {
                hashes: kept.map((passage) => passage.hash),
                folded: foldedText(kept.map((passage) => passage.text).join(" ")),
            })
            await this.facts.finalizeOrphans(source.workspaceId, gone.orphans, {
                kind: "note",
                ref: `nature:${source.id}`,
                label: `The document "${source.title.slice(0, 80)}" is no longer read as the shop's rules there: no source supports this value`,
            })
            this.logger.info(FactReadingLogEvent.NatureWithdrew, { sourceId: source.id, passages: left.size, withdrawn: gone.withdrawn })
        } catch (cause) {
            this.logger.error(BrainLogEvent.WithdrawFailed, cause, { sourceId: source.id })
        }
    }

    /** Stage 2: the truths of every rule passage this version has not read are filed as proposals. */
    async extract(input: StageInput): Promise<StageResult> {
        const { source, passages, state } = input
        const batches = batchesOf(
            passages.filter((passage) => needsTruths(passage)),
            PASSAGES_PER_CALL,
        )
        const run: Run = {
            source,
            stage: "extract",
            batches,
            counts: {
                passagesTotal: passages.length,
                passagesTriaged: passages.length,
                passagesKept: passages.filter((passage) => passage.triage === "rule").length,
            },
            before: state.done,
            judged: passages.length,
            // The whole document, for the one call that reads its own date when a line gives a period relative to it.
            documentLines: passages.flatMap((passage) => numberedLinesOf(passage.text)),
        }
        const start: Step = { index: 0, calls: 0, state, verdicts: new Map(), read: new Set() }
        await this.save(run, start, "running", null)
        const ended = await this.extractFrom(run, start)
        return {
            ...ended,
            passages: passages.map((passage) =>
                ended.step.read.has(passage.id) ? { ...passage, truthsVersion: TRUTHS_VERSION } : passage,
            ),
        }
    }

    /**
     * Judges the batch at `step.index`, then the next, until the stage is done, the job's budget is made, the credits end or the model
     * does not answer. An answer cut at its cap or unreadable splits its batch in two (D-N-9: the same prompt would be cut again); one
     * passage the model cannot sort alone is judged `rule`, so no rule is lost.
     */
    private async triageFrom(run: Run, step: Step): Promise<Ended> {
        const batch = run.batches[step.index]
        if (batch === undefined) return this.ended("done", run, step)
        const stopped = await this.stoppedBefore(run, step, TRIAGE_CALLS_PER_JOB)
        if (stopped !== null) return stopped
        const workspaceId = run.source.workspaceId
        const prompt = triagePrompt(
            run.source.title,
            batch.map((passage) => passage.text),
        )
        const tried = await this.ask({
            system: TRIAGE_PROMPT,
            turns: [{ role: "user", content: prompt }],
            budget: triageBudgetOf(batch.length),
            outputSchema: TRIAGE_SCHEMA,
            workspaceId,
            tryNumber: 1,
        })
        if (!tried.ok && !wroteNothingUsable(tried)) return this.failed(run, step, true)
        const parsed = tried.ok ? parseTriage(this.json.jsonOf(tried.answer.text, workspaceId), batch.length) : null
        const counted: Step = { ...step, calls: step.calls + 1 }
        if (parsed === null && batch.length > 1) {
            this.logger.info(FactReadingLogEvent.TriageSplit, {
                sourceId: run.source.id,
                passages: batch.length,
                cut: cutOf(tried),
            })
            return this.triageFrom({ ...run, batches: splitAt(run.batches, step.index) }, counted)
        }
        if (parsed === null) this.logger.warn(FactReadingLogEvent.TriageFallback, { sourceId: run.source.id, cut: cutOf(tried) })
        const verdicts: ReadonlyArray<TriageVerdict> = parsed ?? ["rule"]
        const judged = batch.map((passage, index): PassageVerdict => ({ id: passage.id, verdict: verdicts[index] ?? "none" }))
        await this.chunks.setTriage(workspaceId, judged, TRIAGE_VERSION)
        const next = afterTriage(step, counted, tried.ok ? tried.answer.model : step.state.model, judged)
        await this.save(run, next, "running", null)
        return this.triageFrom(run, next)
    }

    /**
     * Reads the window at `step.index`, then the next, until the stage is done, the job's budget is made, the credits end or the model
     * does not answer. A window cut at its cap is split in two; a window whose answer cannot be read (even after one follow-up) is
     * SKIPPED and recorded, and the reading goes on with the next (D-N-10).
     */
    private async extractFrom(run: Run, step: Step): Promise<Ended> {
        const batch = run.batches[step.index]
        if (batch === undefined) return this.ended("done", run, step)
        const stopped = await this.stoppedBefore(run, step, CALLS_PER_JOB)
        if (stopped !== null) return stopped
        const { source } = run
        const workspaceId = source.workspaceId
        // The passage is shown as written: the reading is told passages are data (rule 8); no code decides what addresses a model.
        const read = batch.map((passage) => ({ id: passage.id, text: passage.text, hash: passage.hash }))
        const prompt = userPrompt({ title: source.title, passages: read })
        const first = await this.ask({
            system: SYSTEM_PROMPT,
            turns: [{ role: "user", content: prompt }],
            budget: TRUTHS_BUDGET,
            workspaceId,
            tryNumber: 1,
        })
        if (!first.ok && !wroteNothingUsable(first)) return this.failed(run, step, true)
        if (cutOf(first) && batch.length > 1) {
            this.logger.info(FactReadingLogEvent.WindowSplit, { sourceId: source.id, passages: batch.length })
            return this.extractFrom({ ...run, batches: splitAt(run.batches, step.index) }, { ...step, calls: step.calls + 1 })
        }
        const window = await this.readWindow(run, step, read, prompt, first)
        const ids = batch.map((passage) => passage.id)
        const readable = window.skipped === null ? window.parsed : null
        const dated = readable === null ? step : await this.documentDateFor(run, step, readable)
        const filed = readable === null ? await this.skip(run, step, ids, window) : await this.keep(run, dated, read, readable, ids)
        const next = afterWindow(dated, window, filed, ids)
        await this.save(run, next, "running", null)
        return this.extractFrom(run, next)
    }

    /**
     * Reads one window's answer LINE BY LINE (`parseFacts`). When no line can be read, or every truth line names a value its passage
     * does not hold, or labels are not in the document's language, the model is asked ONCE more with its own answer in front of it and
     * what was wrong with it (a retry that changes the prompt); the second answer is taken when it reads better. Still nothing readable:
     * the window is to be skipped, with why.
     */
    private async readWindow(
        run: Run,
        step: Step,
        read: ReadonlyArray<ReadPassage>,
        prompt: string,
        first: AiChatAttempt,
    ): Promise<WindowRead> {
        if (!first.ok) return { parsed: null, answer: null, calls: 1, skipped: cutOf(first) ? "cut" : "empty", raw: [] }
        const timeZone = await this.zones.timeZoneOf(run.source.workspaceId)
        const parsed = parseFacts(first.answer.text, read, timeZone)
        const why = followUpFor(parsed)
        if (why === null) return { parsed, answer: first.answer, calls: 1, skipped: null, raw: [first.answer.text] }
        this.logger.info(FactReadingLogEvent.WindowFollowUp, { sourceId: run.source.id, call: step.state.done, why })
        const second = await this.ask({
            system: SYSTEM_PROMPT,
            turns: [
                { role: "user", content: prompt },
                { role: "assistant", content: first.answer.text.slice(0, FOLLOW_UP_ANSWER_MAX) },
                { role: "user", content: followUpOf(why, languageOf(read), parsed.unaccounted, parsed.faults, parsed.unclear) },
            ],
            budget: TRUTHS_BUDGET,
            workspaceId: run.source.workspaceId,
            tryNumber: 2,
        })
        const again = second.ok ? parseFacts(second.answer.text, read, timeZone) : null
        const better = again !== null && again.valid && readsBetter(again, parsed, why)
        const kept = better ? again : parsed
        const answer = better && second.ok ? second.answer : first.answer
        const raw = [first.answer.text, ...(second.ok ? [second.answer.text] : [])]
        return { parsed: kept, answer, calls: 2, skipped: kept.valid ? null : "unreadable", raw }
    }

    /**
     * Files the truths of a read window, records the lines it refused (counted, kept in the reading's notes, never logged), runs the
     * same-meaning check and marks its passages read by this version. Answers how many truths were filed.
     */
    private async keep(
        run: Run,
        step: Step,
        read: ReadonlyArray<ReadPassage>,
        parsed: ParsedFacts,
        ids: ReadonlyArray<string>,
    ): Promise<number> {
        const { source } = run
        const workspaceId = source.workspaceId
        if (parsed.refused.length > 0) {
            this.logger.info(FactReadingLogEvent.LinesRefused, {
                sourceId: source.id,
                call: step.state.done,
                kept: parsed.facts.length,
                refused: parsed.refused.length,
                ungrounded: parsed.ungrounded,
            })
            await this.extractions.note(workspaceId, source.id, {
                skipped: false,
                note: this.noteOf("refused", read, parsed.refused.length, parsed.refused.join("\n")),
            })
        }
        if (parsed.unaccounted.length > 0) {
            // A line of rule material that gave no truth and was not skipped even after the follow-up: counted and kept, never silent.
            this.logger.info(FactReadingLogEvent.LinesUnaccounted, { sourceId: source.id, call: step.state.done, lines: parsed.unaccounted.length })
            await this.extractions.note(workspaceId, source.id, {
                skipped: false,
                unread: parsed.unaccounted.length,
                note: this.noteOf("unaccounted", read, 0, unaccountedTextOf(read, parsed.unaccounted)),
            })
        }
        const date: DocumentDate = step.documentDate ?? { kind: "unread" }
        const timeZone = await this.zones.timeZoneOf(workspaceId)
        const created = await this.file(source, parsed.facts.map((fact) => datedFactOf(fact, date, timeZone)))
        if (created.failed.length > 0) {
            // A truth the store refused to file is not lost in silence: counted as a refused line, its words kept in the notes.
            await this.extractions.note(workspaceId, source.id, {
                skipped: false,
                note: this.noteOf("refused", read, created.failed.length, filingFailedTextOf(created.failed)),
            })
        }
        // The same truth in other words (another label in another passage or document): one judgement per truth with a near candidate,
        // a flag the settle reads. Never stops the reading.
        await this.vectors.checkSameMeaning(workspaceId, created.facts)
        await this.chunks.markTruthsRead(workspaceId, ids, TRUTHS_VERSION)
        return created.filed
    }

    /**
     * Skips a window whose answer could not be read (D-N-10): its passages are marked as skipped by this version (`SKIPPED_VERSION`: the
     * reading goes on past them, the next reading reads them again), the call is counted and its raw answer kept in the reading's notes
     * (the tenant's row, never a log line). Files nothing.
     */
    private async skip(run: Run, step: Step, ids: ReadonlyArray<string>, window: WindowRead): Promise<number> {
        const { source } = run
        const reason = window.skipped ?? "unreadable"
        const answer = window.raw.join(ANSWERS_APART)
        this.logger.warn(FactReadingLogEvent.WindowSkipped, {
            sourceId: source.id,
            call: step.state.done,
            passages: ids.length,
            reason,
            answerChars: answer.length,
        })
        await this.extractions.note(source.workspaceId, source.id, {
            skipped: true,
            note: {
                at: this.clock.now().toISOString(),
                reason,
                passages: [...ids],
                refused: window.parsed?.refused.length ?? 0,
                answer,
            },
        })
        await this.chunks.markTruthsRead(source.workspaceId, ids, SKIPPED_VERSION)
        return 0
    }

    /**
     * The date the document states as its own, read ONCE per job and only when a truth of this window gave a period relative to it
     * (rule 4b): one call over the start and the end of the document, booked and counted in the job's calls like the others. Asked
     * already, or no relative period: the step as it is. The call is never retried: an unusable answer is `unread`, and the truths
     * that needed it are filed WITHOUT a period, flagged `period_unclear`, with a note saying which date was missing (`datedFactOf`):
     * a note for the founder, never a question.
     */
    private async documentDateFor(run: Run, step: Step, parsed: ParsedFacts): Promise<Step> {
        if (step.documentDate !== undefined || !parsed.facts.some((fact) => fact.relative !== undefined)) return step
        const shown = dateLinesOf(run.documentLines ?? [])
        const tried = await this.ask({
            system: DOCUMENT_DATE_PROMPT,
            turns: [{ role: "user", content: documentDatePrompt(run.source.title, shown) }],
            budget: DATE_BUDGET,
            workspaceId: run.source.workspaceId,
            tryNumber: 1,
        })
        const documentDate: DocumentDate = tried.ok ? parseDocumentDate(tried.answer.text, shown) : { kind: "unread" }
        this.logger.info(FactReadingLogEvent.DocumentDateRead, { sourceId: run.source.id, outcome: documentDate.kind })
        return { ...step, calls: step.calls + 1, documentDate }
    }

    /** A note of the reading about one window. */
    private noteOf(reason: AnswerNoteReason, read: ReadonlyArray<ReadPassage>, refused: number, answer: string) {
        return { at: this.clock.now().toISOString(), reason, passages: read.map((passage) => passage.id), refused, answer }
    }

    /** Why the next call is not made, or null when it may be: the job made its budget of calls, or the credit pool is empty (the reading then waits, saved). */
    private async stoppedBefore(run: Run, step: Step, budget: number): Promise<Ended | null> {
        if (step.calls >= budget) return this.ended("budget", run, step)
        if (!(await this.usage.blockedBy(run.source.workspaceId, "brain", false))) return null
        await this.save(run, step, "blocked_credits", StoredNote.NoCreditsForFacts)
        return this.ended("blocked", run, step)
    }

    /**
     * The model did not answer at all (a timeout, a provider error): the try is counted. Before `MAX_ATTEMPTS` in a row the stage asks for
     * the job to be run again (the queue retries later, when the model may answer; the passages already done are not worked twice); at
     * `MAX_ATTEMPTS` the reading is given up, saved as failed. An answer that could not be USED never comes here: it is split, asked
     * once more, or skipped.
     */
    private async failed(run: Run, step: Step, silent: boolean): Promise<Ended> {
        const attempts = step.state.attempts + 1
        const note = silent ? ExtractionNote.ModelBusy : ExtractionNote.AnswerUnreadable
        const counted: Step = { ...step, state: { ...step.state, attempts } }
        const gaveUp = attempts >= MAX_ATTEMPTS
        await this.save(run, counted, gaveUp ? "failed" : "running", note)
        return this.ended(gaveUp ? "gave_up" : "retry", run, counted)
    }

    /** How a stage ended, with what is left of it. */
    private ended(end: StageEnd, run: Run, step: Step): Ended {
        return { end, state: step.state, left: run.batches.length - step.index, step }
    }

    /** Saves where the reading stands in the stage. */
    private save(run: Run, step: Step, status: ExtractionStatus, error: string | null): Promise<void> {
        const { source, stage } = run
        const coded = run.judged
        const judgedByModel = run.batches.slice(0, step.index).reduce((sum, batch) => sum + batch.length, 0)
        const left = run.batches.length - step.index
        return this.extractions.save(source.workspaceId, source.id, {
            status,
            windowsDone: step.state.done,
            factsProposed: step.state.filed,
            windowsTotal: run.before === null ? step.state.done : step.state.done + left,
            error,
            attempts: step.state.attempts,
            stage,
            counts: stage === "triage" ? { ...run.counts, passagesTriaged: coded + judgedByModel } : run.counts,
        })
    }

    /** One model call, when it is this call's turn at the model, metered as `brain`; answers the try as it went. */
    private ask(ask: Ask): Promise<AiChatAttempt> {
        // Booked per stage of the document's reading: `work_kind` from the reading's scope, `step_key` triage or extract.
        return withWorkStep(ask.system === TRIAGE_PROMPT ? "triage" : "extract", "document_read", async () => {
            const tried = await this.modelGate.run(() =>
                this.ai.attempt({
                    // The stable head (the standing instructions) is marked for the provider's cache; the passages follow it.
                    messages: [{ role: "system", content: ask.system, cacheMark: true }, ...ask.turns],
                    json: false,
                    schema: null,
                    timeoutMs: CALL_TIMEOUT_MS,
                    budget: ask.budget,
                    ...(ask.outputSchema === undefined ? {} : { outputSchema: ask.outputSchema }),
                    context: null,
                    affinity: ask.workspaceId,
                    // Triage and extraction are decisions of meaning: the strong model (owner 2026-11-12, round A).
                    target: INGESTION_TARGET,
                }),
            )
            // Every try that returned tokens is booked, one cut at its cap included (concept.tokens-and-credits); only an answer is read.
            const spend = spendOf(tried)
            if (spend !== null) {
                await this.usage.record({
                    workspaceId: ask.workspaceId,
                    kind: "brain",
                    module: "knowledge",
                    promptChars: ask.system.length + ask.turns.reduce((sum, turn) => sum + turn.content.length, 0),
                    tryNumber: ask.tryNumber,
                    ...spend,
                })
            }
            return tried
        })
    }

    /**
     * Files the truths of one call as proposals (never in force here: the settle decides), each naming the passage it was read from and
     * its stated end; answers how many were filed, the rows that were new and the truths the store refused (counted by the caller).
     */
    private async file(source: SourceRecord, found: ReadonlyArray<ExtractedFact>): Promise<CallFiled> {
        let filed = 0
        const created: Array<FactRecord> = []
        const failed: Array<ExtractedFact> = []
        await eachInOrder(found, async (fact) => {
            try {
                const result = await this.facts.propose(source.workspaceId, proposalOf(source, fact))
                filed += 1
                if (result.created === true) created.push(result.fact)
            } catch (cause) {
                failed.push(fact)
                this.logger.error(BrainLogEvent.FilingFailed, cause, { sourceId: source.id })
            }
        })
        return { filed, facts: created, failed }
    }
}
