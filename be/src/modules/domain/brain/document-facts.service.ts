import { createHash } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { BrainExtractionsService, ExtractionNote } from "@modules/domain/brain-extractions"
import type { MaybeExtraction } from "@modules/domain/brain-extractions"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { Evidence } from "@modules/domain/brain-facts"
import { DOC_ANSWERS, KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { KnowledgeIndexingService, UsageMeterService } from "@modules/domain/knowledge"
import { KnowledgeSourcesService, StoredNote, factsPercent } from "@modules/domain/knowledge-sources"
import type { SourceRecord } from "@modules/domain/knowledge-sources"
import { InjectAi } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { InjectLogger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import type { Logger } from "@modules/platform/logging"
import { DocumentReviewService } from "./document-review.service"
import { ModelJsonService } from "./model-json.service"
import { sourcePayloadOf } from "./brain-payload.policy"
import { BrainError, BrainErrorCode } from "./errors/brain.error"
import type { ExtractedFact } from "./extraction.policy"
import { MAX_FACTS_PER_DOC, PROMPT_VERSION, SYSTEM_PROMPT, parseFacts, userPrompt } from "./extraction.policy"
import type { FactsOutcome, ReadingPlan } from "./brain.contracts"
import { readingPlanOf } from "./reading-plan.policy"
import { BrainLogEvent } from "./brain.log-events"

/** How many windows in a row may fail before the reading is given up. */
const MAX_ATTEMPTS = 3

/** How long the model may take to read one window. */
const WINDOW_TIMEOUT_MS = 40_000

/** The fingerprint of a text, to tell whether it was read already. */
const hashOf = (content: string): string => createHash("sha256").update(content).digest("hex").slice(0, 32)

@Injectable()
/**
 * Facts out of documents, partially: when one document becomes ready only THAT document is read; when it changes or is deleted only what
 * it contributed is withdrawn and read again. Cost follows the change, the owner's decisions are kept, and values do not reshuffle.
 * Every model call is charged to the workspace's credits under the kind `brain`, and with no credits nothing runs.
 */
export class DocumentFactsService {
    constructor(
        @InjectAi() private readonly ai: AiService,
        @InjectLogger() private readonly logger: Logger,
        private readonly facts: BrainFactsService,
        private readonly gaps: KnowledgeGapsService,
        private readonly extractions: BrainExtractionsService,
        private readonly indexing: KnowledgeIndexingService,
        private readonly sources: KnowledgeSourcesService,
        private readonly usage: UsageMeterService,
        private readonly json: ModelJsonService,
        private readonly reviews: DocumentReviewService,
    ) {}

    /** Reads the facts of the source a facts job names; a payload of another shape is logged and dropped. */
    async run(payload: object): Promise<FactsOutcome> {
        const run = sourcePayloadOf(payload)
        if (run === null) {
            this.logger.warn(BrainLogEvent.PayloadRefused, { job: "facts" })
            return "skipped"
        }
        const source = await this.indexing.sourceForFacts(run.workspaceId, run.sourceId)
        return source === null ? "skipped" : this.read(source)
    }

    /** The reading ended as failed (the retries ran out): the document is kept and ready, with a note that its facts were not read. */
    async giveUp(payload: object): Promise<void> {
        const run = sourcePayloadOf(payload)
        if (run === null) return
        await this.extractions.fail(run.workspaceId, run.sourceId, ExtractionNote.Aborted)
        await this.sources.ready(run.workspaceId, run.sourceId, StoredNote.FactsUnread)
        await this.reviews.requestForSource(run.workspaceId, run.sourceId)
    }

    /** Takes back what a deleted document contributed and proposes to retire the facts that lost their last evidence. */
    async withdraw(workspaceId: string, sourceId: string, title: string): Promise<void> {
        try {
            const orphans = await this.facts.withdrawSource(workspaceId, sourceId, "source changed")
            await this.facts.finalizeOrphans(workspaceId, orphans, this.goneEvidence(sourceId, title, "was deleted"))
        } catch (cause) {
            this.logger.error(BrainLogEvent.WithdrawFailed, cause, { sourceId })
        }
        await this.reviews.requestForGoneSource(workspaceId, sourceId, title)
    }

    /** Reads what changed in a document window by window, filing every valid fact as a proposal (document trust is below auto-apply, so the owner reviews them). */
    private async read(source: SourceRecord): Promise<FactsOutcome> {
        const workspaceId = source.workspaceId
        const hash = hashOf(source.content)
        const known = await this.extractions.get(workspaceId, source.id)
        const same = known !== null && known.contentHash === hash && known.promptVersion === PROMPT_VERSION
        if (same && known.status === "done") {
            await this.sources.settle(workspaceId, source.id, source.content)
            return "skipped"
        }
        const plan = readingPlanOf(source.content, known?.promptVersion === PROMPT_VERSION ? known.passageHashes : [])
        if (!same) await this.restart(source, hash, plan, known)
        const resume = same ? known : await this.extractions.get(workspaceId, source.id)
        return this.window(source, plan.windows, {
            partial: plan.partial,
            passages: plan.hashes,
            changed: resume?.factsChanged ?? false,
            done: resume?.windowsDone ?? 0,
            filed: resume?.factsProposed ?? 0,
            attempts: resume?.attempts ?? 0,
            orphans: resume?.orphanFactIds ?? [],
            model: "",
        })
    }

    /** The text changed: what it no longer says is withdrawn, facts resting on unchanged passages stay, and a new reading starts. */
    private async restart(
        source: SourceRecord,
        hash: string,
        plan: ReadingPlan,
        known: MaybeExtraction,
    ): Promise<void> {
        const workspaceId = source.workspaceId
        const taken =
            known === null
                ? { orphans: [], withdrawn: 0 }
                : await this.facts.withdrawChanged(workspaceId, source.id, "source changed", plan.unchangedText)
        await this.extractions.start({
            workspaceId,
            sourceId: source.id,
            promptVersion: PROMPT_VERSION,
            contentHash: hash,
            windowsTotal: plan.windows.length,
            orphanFactIds: [...new Set([...(known?.orphanFactIds ?? []), ...taken.orphans])],
            factsChanged: taken.withdrawn > 0 || (known?.status !== "done" && known?.factsChanged === true),
        })
    }

    /** Reads the window at `state.done`, then the next, until the document is read, the credits end or the model fails. */
    private async window(source: SourceRecord, windows: ReadonlyArray<string>, state: Reading): Promise<FactsOutcome> {
        const workspaceId = source.workspaceId
        const total = windows.length
        const progress = (status: "running" | "failed" | "blocked_credits", error: string | null, attempts: number) =>
            this.extractions.save(workspaceId, source.id, {
                status,
                windowsDone: state.done,
                factsProposed: state.filed,
                windowsTotal: total,
                error,
                attempts,
            })
        if (state.done >= total || state.filed >= MAX_FACTS_PER_DOC) return this.finish(source, state)
        if (await this.usage.blockedBy(workspaceId, "brain", false)) {
            await progress("blocked_credits", null, state.attempts)
            await this.sources.blockFacts(workspaceId, source.id, StoredNote.NoCreditsForFacts)
            return "blocked"
        }
        const text = windows[state.done] ?? ""
        const prompt = userPrompt({ title: source.title, updatedAt: source.updatedAt, index: state.done, total, text })
        const answer = await this.ai.chat({
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: prompt },
            ],
            json: false,
            schema: null,
            timeoutMs: WINDOW_TIMEOUT_MS,
            context: null,
        })
        if (answer !== null) {
            await this.usage.record({
                workspaceId,
                kind: "brain",
                module: "knowledge",
                model: answer.model,
                usage: answer.usage,
                promptChars: SYSTEM_PROMPT.length + prompt.length,
                completionChars: answer.text.length,
            })
        }
        const parsed = answer === null ? null : parseFacts(this.json.jsonOf(answer.text), text)
        if (!parsed?.valid) {
            const attempts = state.attempts + 1
            const note = answer === null ? ExtractionNote.ModelBusy : ExtractionNote.AnswerUnreadable
            if (attempts >= MAX_ATTEMPTS) {
                await progress("failed", note, attempts)
                await this.sources.ready(workspaceId, source.id, StoredNote.FactsUnread)
                await this.reviews.requestForSource(workspaceId, source.id)
                return "failed"
            }
            await progress("running", note, attempts)
            throw new BrainError({ code: BrainErrorCode.ModelUnavailable })
        }
        const filed = await this.file(source, parsed.facts, MAX_FACTS_PER_DOC - state.filed)
        const next = {
            ...state,
            done: state.done + 1,
            filed: state.filed + filed,
            attempts: 0,
            model: answer?.model ?? state.model,
        }
        await this.extractions.save(workspaceId, source.id, {
            status: "running",
            windowsDone: next.done,
            factsProposed: next.filed,
            windowsTotal: total,
            error: null,
            attempts: 0,
        })
        await this.sources.advance(workspaceId, source.id, {
            stage: "facts",
            done: next.done,
            total,
            progress: factsPercent(next.done, total),
        })
        return this.window(source, windows, next)
    }

    /** Files the facts of one window as proposals; answers how many were filed. */
    private async file(source: SourceRecord, found: ReadonlyArray<ExtractedFact>, room: number): Promise<number> {
        let filed = 0
        await eachInOrder(found.slice(0, room), async (fact) => {
            try {
                await this.facts.propose(source.workspaceId, {
                    subjectType: fact.subjectType,
                    subjectLabel: fact.subjectLabel,
                    attributeLabel: fact.attributeLabel,
                    value: fact.value,
                    unit: fact.unit,
                    // Public only when the model says so AND the owner marked the document public; otherwise the audience of the fact it may replace.
                    scope: fact.scope === "public" && source.visibility === "public" ? "public" : undefined,
                    sourceKind: "document",
                    validFrom: fact.validFrom,
                    autoApply: false,
                    // A document kept for one agent instance proposes facts for that instance only.
                    installationId: source.installationId,
                    proposedBy: `Document: ${source.title.slice(0, 80)}`,
                    evidence: [this.documentEvidence(source, fact.quote)],
                })
                filed += 1
            } catch (cause) {
                this.logger.error(BrainLogEvent.FilingFailed, cause, { sourceId: source.id })
            }
        })
        return filed
    }

    /** The document is read: facts that lost their evidence are proposed for retirement, the gaps it covers are answered, the source is ready, and its dossier is reviewed again when the facts changed or the whole document was read. */
    private async finish(source: SourceRecord, state: Reading): Promise<FactsOutcome> {
        const workspaceId = source.workspaceId
        await this.facts.finalizeOrphans(
            workspaceId,
            state.orphans,
            this.goneEvidence(source.id, source.title, "changed"),
        )
        await this.extractions.finish(workspaceId, source.id, state.model, state.passages)
        if (source.visibility === "public") {
            try {
                await this.gaps.resolve(workspaceId, {
                    text: `${source.title} ${source.topic ?? ""} ${source.content}`,
                    minimum: DOC_ANSWERS,
                    module: source.module,
                    by: `document:${source.id}`,
                })
            } catch (cause) {
                this.logger.error(BrainLogEvent.GapsFailed, cause, { sourceId: source.id })
            }
        }
        await this.sources.settle(workspaceId, source.id, source.content)
        if (!state.partial || state.changed || state.filed > 0)
            await this.reviews.requestForSource(workspaceId, source.id)
        return "done"
    }

    /** The evidence a fact carries about the document it was read from. */
    private documentEvidence(source: SourceRecord, quote: string | null): Evidence {
        return {
            kind: "document",
            ref: source.id,
            label: source.title,
            quote: quote ?? undefined,
            at: source.updatedAt,
            sourceId: source.id,
            title: source.title,
        }
    }

    /** The note a fact keeps when its last supporting document is gone. */
    private goneEvidence(sourceId: string, title: string, what: string): Evidence {
        return {
            kind: "note",
            ref: `gone:${sourceId}`,
            label: `The document "${title}" ${what}: no source supports this value any more`,
        }
    }
}

/** Where a reading stands between two windows. */
interface Reading {
    /** True when only changed passages are read. */
    readonly partial: boolean
    /** The hashes of every passage of the document. */
    readonly passages: ReadonlyArray<string>
    /** Whether this reading already withdrew facts. */
    readonly changed: boolean
    /** Windows read. */
    readonly done: number
    /** Facts filed. */
    readonly filed: number
    /** Tries that failed in a row. */
    readonly attempts: number
    /** Active facts waiting for the new reading to confirm them. */
    readonly orphans: ReadonlyArray<string>
    /** The model that read the last window. */
    readonly model: string
}
