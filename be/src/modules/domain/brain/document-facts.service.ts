import { createHash } from "node:crypto"
import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import {
  BrainExtractionsService,
  ExtractionNote,
  type ExtractionRecord,
  type ExtractionStage,
  type ExtractionStatus,
  type MaybeExtraction,
} from "@modules/domain/brain-extractions"
import { BrainFactsService, foldedText, type Evidence } from "@modules/domain/brain-facts"
import { DocumentCriticService, type CritiqueChangedHook } from "@modules/domain/dossier-review"
import { KnowledgeChunksService, type TruthPassage } from "@modules/domain/knowledge-chunks"
import { KnowledgeIndexingService, UsageMeterService } from "@modules/domain/knowledge"
import { KnowledgeSourcesService, StoredNote, type SourceRecord } from "@modules/domain/knowledge-sources"
import { TeamChatNoticesService, type BackgroundStopReason } from "@modules/domain/team-chat"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, withWorkScope, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { sourcePayloadOf } from "./brain-payload.policy"
import type { FactsOutcome } from "./brain.contracts"
import { BrainLogEvent } from "./brain.log-events"
import { DocumentRelationsService } from "./document-relations.service"
import { DocumentReviewService } from "./document-review.service"
import { DocumentSettleService } from "./document-settle.service"
import { DocumentTruthStagesService } from "./document-truth-stages.service"
import type { Reading, StageResult } from "./document-truths.contracts"
import { BrainError, BrainErrorCode } from "./errors/brain.error"
import { TRUTHS_VERSION, needsTruths, wasSkipped } from "./extraction.policy"
import { FactReadingLogEvent } from "./fact-reading.log-events"
import { needsTriage } from "./passage-triage.policy"
import { TruthCeilingService } from "./truth-ceiling.service"

/** The most waiting readings one upkeep tick looks at; the rest are looked at by the next tick. */
const RESUME_MAX = 50

/** The fingerprint of a text, to tell whether it was read already. */
const hashOf = (content: string): string => createHash("sha256").update(content).digest("hex").slice(0, 32)

/**
 * The place of each reason among the reports of one version of a document, in milliseconds after the version's time: the founder's
 * room keeps ONE card per work and episode, so each reason is an episode of its own and a document that first waited for credits and
 * later reached the ceiling tells both.
 */
const REASON_PLACE: Readonly<Record<BackgroundStopReason, number>> = { credits: 0, model: 1, gave_up: 2, ceiling: 3 }

/**
 * The note a finished reading keeps, so the document always says what happened (D-N-10, D-N-11): calls skipped first (their passages
 * wait for the next reading), then lines refused when nothing was filed, then truths that wait for the founder's yes (a document that
 * is not his); none when every truth was settled.
 */
export const endNoteOf = (row: ExtractionRecord): ExtractionNote | null => {
    if (row.windowsSkipped > 0) return ExtractionNote.WindowsSkipped
    if (row.linesRefused > 0 && row.factsProposed === 0) return ExtractionNote.LinesRefused
    if ((row.linesUnread ?? 0) > 0) return ExtractionNote.LinesUnread
    return row.counts.factsWaiting > 0 ? ExtractionNote.AwaitingFounder : null
}

/** Whether a passage still needs a stage. */
const needsWork = (passage: TruthPassage): boolean => needsTriage(passage) || needsTruths(passage)

@Injectable()
/**
 * The truths of a document, indexed OUT of it (owner 2026-11-11, concept truth-graph `ingestionTwoPaths`). A document is stored and
 * searchable before this work starts and whatever becomes of it; this job only decides what of it enters the truth graph, in three
 * stages that each resume from the passages themselves (no cursor to lose):
 * 1. TRIAGE: which passages state a rule of the shop (`DocumentTruthStagesService.triage`).
 * 2. EXTRACT: the truths of the rule passages only, each filed as a PROPOSAL (`DocumentTruthStagesService.extract`).
 * 3. SETTLE, as soon as the document's (or the part's) own reading ends: the truths of a document a member of the workspace stands
 *    behind go in force directly, and only a contradiction asks the founder (`DocumentSettleService`). The critic is asked to read
 *    the document at the same time (customers' gate, contradiction points, text addressed to an AI), in the background: the settle
 *    never waits for it, and a point it raises, or an answer of the founder, settles the document again (`critiqued`).
 * Every model call is charged to the workspace's credit pool and checked against it first; there is no other quota. With no credits,
 * or at the ceiling of truths in force the reading WAITS (nothing is lost) and the upkeep tick lets it go on. One job makes a bounded
 * number of calls and then hands over to a follow-up job.
 */
export class DocumentFactsService implements OnModuleInit, CritiqueChangedHook {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly queue: KnowledgeQueue,
        private readonly facts: BrainFactsService,
        private readonly extractions: BrainExtractionsService,
        private readonly indexing: KnowledgeIndexingService,
        private readonly sources: KnowledgeSourcesService,
        private readonly chunks: KnowledgeChunksService,
        private readonly usage: UsageMeterService,
        private readonly reviews: DocumentReviewService,
        private readonly links: DocumentRelationsService,
        private readonly stages: DocumentTruthStagesService,
        private readonly settling: DocumentSettleService,
        private readonly ceiling: TruthCeilingService,
        @Optional() private readonly notices?: TeamChatNoticesService,
        @Optional() private readonly critic?: DocumentCriticService,
    ) {}

    /**
     * Listens to the critic: when its word on a document changes (a point was raised, the founder answered or skipped one, a decision
     * on the graph closed one), `critiqued` settles that document's waiting truths again.
     */
    onModuleInit(): void {
        this.critic?.whenChanged(this)
    }

    /** Works on the truths of the document a job names; a payload of another shape is logged and dropped. */
    async run(payload: object): Promise<FactsOutcome> {
        const run = sourcePayloadOf(payload)
        if (run === null) {
            this.logger.warn(BrainLogEvent.PayloadRefused, { job: "facts" })
            return "skipped"
        }
        // A settle asked for by a change of the critic's verdict: a reading that ended or waits since the job was queued (the settle it
        // interrupted finished meanwhile) is opened again here, so this job settles with the verdict as it stands now.
        if (run.settleAgain === true) await this.extractions.reopen(run.workspaceId, run.sourceId)
        const source = await this.indexing.sourceForFacts(run.workspaceId, run.sourceId)
        return source === null ? "skipped" : this.read(source)
    }

    /** The job ended as failed (the retries ran out): the document stays searchable, its truths are marked unread, and the founder is told. */
    async giveUp(payload: object): Promise<void> {
        const run = sourcePayloadOf(payload)
        if (run === null) return
        await this.extractions.fail(run.workspaceId, run.sourceId, ExtractionNote.Aborted)
        await this.sources.ready(run.workspaceId, run.sourceId, StoredNote.FactsUnread)
        await this.reviews.requestForSource(run.workspaceId, run.sourceId)
        const source = await this.sources.sourceOf(run.workspaceId, run.sourceId)
        if (source !== null) await this.report(source, "gave_up")
    }

    /** Takes back what a deleted document contributed and proposes to retire the truths that lost their last evidence. */
    async withdraw(workspaceId: string, sourceId: string, title: string): Promise<void> {
        try {
            const orphans = await this.facts.withdrawSource(workspaceId, sourceId, "source changed")
            await this.facts.finalizeOrphans(workspaceId, orphans, this.goneEvidence(sourceId, title, "was deleted"))
        } catch (cause) {
            this.logger.error(BrainLogEvent.WithdrawFailed, cause, { sourceId })
        }
        await this.reviews.requestForGoneSource(workspaceId, sourceId)
    }

    /**
     * The critic's word on a document changed (a point was raised or closed, or the founder answered or skipped one): the document's
     * waiting truths are settled again. A contradiction point raised after its truths settled changes nothing for a truth already in
     * force; an answer decides the truths it names. Its reading is opened at the settle stage and a job queued in ONE transaction; a
     * reading that is still triaging or extracting is left to reach the stage by itself. A reading in the MIDDLE of a settle read the
     * verdict before this change, so another settle is queued behind it (`settleAgain`): no answer of the founder is ever left
     * unsettled because it arrived while the document was settling. Answers whether a settle was queued.
     */
    async critiqued(workspaceId: string, sourceId: string): Promise<boolean> {
        const at = this.clock.now().getTime()
        // A point of this document may name truths of OTHER documents (a rival at another scope or in other words): when the founder
        // answers it, those documents settle again too (TRIAGE-4), each through its own queued job, in the same transaction.
        const named = await this.settling.otherSourcesNamedBy(workspaceId, sourceId)
        const others = [...new Set(named)].filter((id) => id !== sourceId)
        return this.entityManager.transaction(async (tx) => {
            await eachInOrder(others, async (other) => {
                if (await this.settlesAgain(workspaceId, other, tx)) {
                    await this.queue.enqueueFactsNext({ sourceId: other, workspaceId, settleAgain: true }, tx, `settle:${sourceId}:${String(at)}`)
                }
            })
            if (!(await this.settlesAgain(workspaceId, sourceId, tx))) return false
            await this.queue.enqueueFactsNext({ sourceId, workspaceId, settleAgain: true }, tx, `settle:${String(at)}`)
            return true
        })
    }

    /**
     * Whether a settle job must be queued for a reading whose verdict changed: it ended or waits at the settle stage (opened again
     * here), or it is in the middle of a settle (left running; the queued job settles after it).
     */
    private async settlesAgain(workspaceId: string, sourceId: string, tx: EntityManager): Promise<boolean> {
        return (await this.extractions.reopen(workspaceId, sourceId, tx)) || (await this.extractions.settling(workspaceId, sourceId, tx))
    }

    /**
     * The upkeep tick, before the readings: a document that ran out of credits while it was INDEXED (its passages stored word-only,
     * `blocked_credits`) is queued for indexing again once the pool has credits; its truths work starts when that index ends
     * (D-U-4: out of credits never loses a document, and nothing waits for a button). Never throws. Answers how many were queued.
     */
    resumeIndexing(): Promise<number> {
        return this.indexing.resumeBlocked()
    }

    /**
     * The upkeep tick: every reading that waits (at most `RESUME_MAX`, the longest-waiting first) goes on when what it waits for is
     * there: credits again, room under the ceiling. Its row leaves the waiting state and a job is queued in the
     * same transaction (only one tick can move a row). Never throws. Answers how many went on.
     */
    async resumeParked(): Promise<number> {
        await this.resumeCritiques()
        try {
            const waiting = await this.extractions.parked(RESUME_MAX)
            const at = this.clock.now().getTime()
            const count = { resumed: 0 }
            await eachInOrder(waiting, async (row) => {
                if (!(await this.mayGoOn(row.workspaceId, row.status))) return
                const moved = await this.entityManager.transaction(async (tx) => {
                    if (!(await this.extractions.resume(row.workspaceId, row.sourceId, tx))) return false
                    const step = `resume:${row.contentHash ?? ""}:${row.status}:${String(at)}`
                    await this.queue.enqueueFactsNext({ sourceId: row.sourceId, workspaceId: row.workspaceId }, tx, step)
                    return true
                })
                if (!moved) return
                this.logger.info(FactReadingLogEvent.ReadingResumed, { sourceId: row.sourceId, waitedFor: row.status })
                count.resumed += 1
            })
            return count.resumed
        } catch (cause) {
            this.logger.error(FactReadingLogEvent.ResumeFailed, cause, {})
            return 0
        }
    }

    /**
     * The upkeep tick, for the critic: a critique that stopped (credits, its bound of calls, the model) goes on once the pool allows
     * a call, its count of runs without progress kept, so it is given up after its runs and never asked for ever. No reading waits
     * for a critique any more, so the tick is the one that resumes it (its security read, and what customers may be served, depend
     * on its end). Never throws.
     */
    private async resumeCritiques(): Promise<void> {
        if (this.critic === undefined) return
        try {
            const stopped = await this.critic.stopped(RESUME_MAX)
            await eachInOrder(stopped, async (one) => {
                if (await this.usage.blockedBy(one.workspaceId, "brain", false)) return
                await this.reviews.requestForSource(one.workspaceId, one.sourceId, { resume: true })
            })
        } catch (cause) {
            this.logger.error(FactReadingLogEvent.ResumeFailed, cause, {})
        }
    }

    /**
     * Whether what a waiting reading waits for is there now: credits for `blocked_credits`, room under the ceiling for `at_ceiling`. A
     * reading an earlier build parked `awaiting_critique` (waiting for the critic, for other parts or for other documents) goes on at
     * once: nothing waits for those any more, and its settle never parks it there again, so it is resumed once.
     */
    private async mayGoOn(workspaceId: string, status: ExtractionStatus): Promise<boolean> {
        if (status === "blocked_credits") return !(await this.usage.blockedBy(workspaceId, "brain", false))
        if (status === "at_ceiling") return (await this.ceiling.room(workspaceId)).truths > 0
        return status === "awaiting_critique"
    }

    /** Opens or resumes the truths work of a document and carries it as far as this job may. */
    private async read(source: SourceRecord): Promise<FactsOutcome> {
        const workspaceId = source.workspaceId
        const hash = hashOf(source.content)
        const passages = await this.chunks.truthPassagesOf(workspaceId, source.id)
        const known = await this.extractions.get(workspaceId, source.id)
        const same = known?.contentHash === hash
        // A finished reading that skipped windows is read again when its document is taken through the work again ("read again").
        if (same && known.status === "done" && !passages.some((passage) => needsWork(passage) || wasSkipped(passage))) {
            await this.sources.settle(workspaceId, source.id, source.content)
            return "skipped"
        }
        // Every model call of this work is booked to the document: a document whose earlier reading finished is being read again.
        const kind = known?.status === "done" ? "document_reread" : "document_read"
        return withWorkScope({ kind, ref: `source:${source.id}` }, async () => {
            const resumes = same && known.status !== "done" && known.status !== "failed"
            if (!resumes) await this.restart(source, hash, passages, same ? null : known, known)
            const row = resumes ? known : await this.extractions.get(workspaceId, source.id)
            return row === null ? "skipped" : this.work(source, hash, passages, row)
        })
    }

    /**
     * A new reading starts. When the text changed, what it no longer says is withdrawn passage by passage (a truth born from an unchanged
     * passage is not touched): `changedFrom` is the reading of the earlier text, null when the text is the same (a prompt change, or a
     * reading given up and run again, withdraws nothing).
     */
    private async restart(
        source: SourceRecord,
        hash: string,
        passages: ReadonlyArray<TruthPassage>,
        changedFrom: MaybeExtraction,
        known: MaybeExtraction,
    ): Promise<void> {
        const workspaceId = source.workspaceId
        // What the last reading skipped (its answer could not be read) is read again by this one: never lost for good (D-N-10).
        const skipped = passages.filter((passage) => wasSkipped(passage)).map((passage) => passage.id)
        await this.chunks.forgetTruthsRead(workspaceId, skipped)
        const covered = new Set(changedFrom?.passageHashes ?? [])
        const unchanged = passages.filter((passage) => covered.has(passage.hash))
        const gone =
            changedFrom === null
                ? { orphans: [], withdrawn: 0 }
                : await this.facts.withdrawChanged(workspaceId, source.id, "source changed", {
                      hashes: unchanged.map((passage) => passage.hash),
                      folded: foldedText(unchanged.map((passage) => passage.text).join(" ")),
                  })
        await this.extractions.start({
            workspaceId,
            sourceId: source.id,
            promptVersion: TRUTHS_VERSION,
            contentHash: hash,
            windowsTotal: 0,
            orphanFactIds: [...new Set([...(known?.orphanFactIds ?? []), ...gone.orphans])],
            factsChanged: gone.withdrawn > 0 || (known?.status !== "done" && known?.factsChanged === true),
            passagesTotal: passages.length,
        })
    }

    /** The stages in order; each one ends by going on to the next, by handing over to a follow-up job, or by waiting. */
    private async work(
        source: SourceRecord,
        hash: string,
        passages: ReadonlyArray<TruthPassage>,
        row: ExtractionRecord,
    ): Promise<FactsOutcome> {
        const state: Reading = {
            hash,
            done: row.windowsDone,
            filed: row.factsProposed,
            attempts: row.status === "failed" ? 0 : row.attempts,
            orphans: row.orphanFactIds,
            model: "",
        }
        if (row.stage === "settle" && !passages.some((passage) => needsWork(passage))) {
            return this.settle(source, passages, state)
        }
        const judged = await this.stages.triage({ source, passages, state })
        if (judged.end !== "done") return this.stopped(source, judged, "triage")
        const read = await this.stages.extract({ source, passages: judged.passages, state: judged.state })
        if (read.end !== "done") return this.stopped(source, read, "extract")
        return this.extracted(source, read.passages, read.state)
    }

    /** A stage did not finish in this job: the reading waits for credits, hands over, is retried by the queue, or is given up. */
    private async stopped(source: SourceRecord, result: StageResult, stage: ExtractionStage): Promise<FactsOutcome> {
        if (result.end === "blocked") {
            await this.report(source, "credits")
            return "blocked"
        }
        if (result.end === "budget") return this.handOver(source, result.state, stage, result.left)
        if (result.end === "retry") throw new BrainError({ code: BrainErrorCode.ModelUnavailable })
        await this.sources.ready(source.workspaceId, source.id, StoredNote.FactsUnread)
        await this.reviews.requestForSource(source.workspaceId, source.id)
        await this.report(source, "model")
        this.logger.warn(FactReadingLogEvent.ReadingGivenUp, { sourceId: source.id, stage })
        return "failed"
    }

    /**
     * Every rule passage is read: the new truths are linked into the graph (a gap is answered by a truth in force under its own keys, never by the words of a document), the critic
     * is asked to read the document (in the background: customers' gate, contradiction points, text addressed to an AI), and the truths
     * settle AT ONCE: nothing waits for the critic, another part of the file or another document.
     */
    private async extracted(source: SourceRecord, passages: ReadonlyArray<TruthPassage>, state: Reading): Promise<FactsOutcome> {
        if (state.filed > 0) await this.links.link(source)
        await this.reviews.requestForSource(source.workspaceId, source.id)
        return this.settle(source, passages, state)
    }

    /** Stage 3: what goes in force is settled; the reading then ends, or waits for room under the ceiling (told to the founder). */
    private async settle(source: SourceRecord, passages: ReadonlyArray<TruthPassage>, state: Reading): Promise<FactsOutcome> {
        const parked = await this.settling.settle(source, passages, state)
        if (parked?.status === "at_ceiling") await this.report(source, "ceiling")
        if (parked !== null) return "waiting"
        const workspaceId = source.workspaceId
        await this.facts.finalizeOrphans(workspaceId, state.orphans, this.goneEvidence(source.id, source.title, "changed"))
        const row = await this.extractions.get(workspaceId, source.id)
        await this.extractions.finish(
            workspaceId,
            source.id,
            state.model,
            passages.map((passage) => passage.hash),
            row === null ? null : endNoteOf(row),
        )
        await this.sources.settle(workspaceId, source.id, source.content)
        return "done"
    }

    /**
     * This job made its budget of calls: a follow-up job of the same document is queued, keyed by the text, the stage and what is left
     * (a retried job that reached the same point queues nothing twice). The follow-up finds the passages already done and goes on.
     */
    private async handOver(source: SourceRecord, state: Reading, stage: ExtractionStage, left: number): Promise<FactsOutcome> {
        const workspaceId = source.workspaceId
        const step = `${state.hash}:${stage}:${String(left)}:${String(state.done)}`
        await this.entityManager.transaction((tx) => this.queue.enqueueFactsNext({ sourceId: source.id, workspaceId }, tx, step))
        this.logger.info(FactReadingLogEvent.ReadingContinued, { sourceId: source.id, stage, left })
        return "continued"
    }

    /**
     * Tells the founder that the truths of a document stopped, once per version of the document and reason; the CEILING is told once
     * per episode of the workspace, however many documents stop at it (each still shows its own `at_ceiling` state): the episode is
     * named by when its first reading stopped, and a new one starts once there was room again. Logged, never thrown.
     */
    private async report(source: SourceRecord, reason: BackgroundStopReason, place: number = REASON_PLACE[reason]): Promise<void> {
        if (this.notices === undefined) return
        try {
            const since = reason === "ceiling" ? await this.extractions.ceilingSince(source.workspaceId) : null
            const posted = await this.notices.postBackgroundStopped(source.workspaceId, {
                work: "brain.documents.truths",
                reason,
                episode: since ?? new Date(Date.parse(source.updatedAt) + place),
            })
            this.logger.info(FactReadingLogEvent.StopReported, { sourceId: source.id, reason, posted })
        } catch (cause) {
            this.logger.error(FactReadingLogEvent.StopReportFailed, cause, { sourceId: source.id })
        }
    }

    /** The note a truth keeps when its last supporting document is gone. */
    private goneEvidence(sourceId: string, title: string, what: string): Evidence {
        return {
            kind: "note",
            ref: `gone:${sourceId}`,
            label: `The document "${title}" ${what}: no source supports this value any more`,
        }
    }
}
