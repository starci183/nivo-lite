import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { BrainExtractionsService } from "@modules/domain/brain-extractions"
import type { TruthPassage } from "@modules/domain/knowledge-chunks"
import { UsageMeterService } from "@modules/domain/knowledge"
import type { SourceRecord } from "@modules/domain/knowledge-sources"
import { InjectAi, NATURE_EFFORT, spendOf, type AiChatAttempt, type AiMessage, type AiService } from "@modules/integrations/ai"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, withWorkStep, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import {
    NATURE_MAX_TOKENS,
    NATURE_PROMPT,
    NATURE_SCHEMA,
    NATURE_VERSION,
    contradictsItself,
    disagreeingOf,
    evidenceIn,
    fallbackReading,
    fileTypeOf,
    formOf,
    mapOf,
    natureInForce,
    naturePrompt,
    needsNature,
    parseNature,
    recheckPrompt,
    storedOverrideOf,
    storedReadingOf,
    tableKeyOf,
    tableShapeOf,
    undecidedOf,
    type DocumentMap,
    type FormMate,
    type NatureInForce,
    type NatureReading,
} from "./document-nature.policy"
import { DocumentPartsService } from "./document-parts.service"
import { FactReadingLogEvent } from "./fact-reading.log-events"
import { INGESTION_TARGET } from "./ingestion-model.policy"
import { ModelJsonService } from "./model-json.service"
import { wroteNothingUsable } from "./truth-window.policy"

/** How long the model may take for the map of one document. */
const CALL_TIMEOUT_MS = 180_000

/** What the follow-up says when the map's answer could not be read (a retry that changes the prompt, never the same one again). */
const FOLLOW_UP =
    'That reply could not be read. Reply again with ONLY the JSON object {"evidence":[...],"entries":...,"nature":...,"reason":...,"sections":{...},"tables":{...}}, entries one of terms, items, events, narrative, explanation, nature one of rules, records, log, reference, mixed. No other text.'

/** How many other parts of the same file, nearest to this one first, are read for their judgements (a bound on the reads). */
const SIBLINGS_READ = 12

/** How many judged parts of the same file the map shows (a bound on the map, not a reading). */
const SIBLINGS_SHOWN = 6

/**
 * Where the judgement of a document stands for a stage: `ready` with the judgement its passages inherit and the calls it took;
 * `blocked`: the credit pool is empty (the reading waits); `retry`: the model did not answer at all (the queue tries the job again).
 */
export type NatureOutcome =
    | { readonly kind: "ready"; readonly nature: NatureInForce; readonly calls: number }
    | { readonly kind: "blocked" }
    | { readonly kind: "retry" }

@Injectable()
/**
 * WHAT A DOCUMENT IS (TRIAGE-2): one call of the strong model per version of a document's text, on its map (outline, samples, the header
 * and sample rows of every table), before any passage is triaged. The answer is closed (`NATURES`, `TABLE_NATURES`) with one line of
 * reason, stored on the reading row and shown on the documents page; the founder's answer replaces it (`overrideNature`). A part of a
 * long file that holds only tables another part already judged takes that judgement for no call (a record export cut into ten parts
 * costs one call). An answer that cannot be read is asked once more; still unreadable, the document is triaged passage by passage as
 * before (`fallback`), never left unread. An answer whose nature and entries contradict each other (`contradictsItself`) is asked once
 * more with the contradiction named; still contradicting, it is no judgement of the whole (`undecidedOf`: triaged passage by passage).
 * The map shows the judgements of like documents and of the other parts of the same file with their entries and quotes (NATURE_VERSION 5).
 */
export class DocumentNatureService {
    constructor(
        @InjectAi() private readonly ai: AiService,
        @InjectLogger() private readonly logger: Logger,
        private readonly extractions: BrainExtractionsService,
        private readonly usage: UsageMeterService,
        private readonly json: ModelJsonService,
        private readonly parts: DocumentPartsService,
        private readonly queue: KnowledgeQueue,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    ) {}

    /** The judgement a document's passages inherit for this text, reading the document first when this text has none. */
    async natureFor(source: SourceRecord, passages: ReadonlyArray<TruthPassage>, contentHash: string): Promise<NatureOutcome> {
        const stored = await this.extractions.natureOf(source.workspaceId, source.id)
        const override = storedOverrideOf(stored.override)
        const known = storedReadingOf(stored.reading)
        if (known !== null && !needsNature(known, contentHash)) return { kind: "ready", nature: natureInForce(known, override), calls: 0 }
        const texts = passages.map((passage) => passage.text)
        const whole = await this.parts.wholeOf(source.workspaceId, source.id)
        const sibling = await this.fromSibling(source, whole, texts, contentHash)
        if (sibling !== null) {
            await this.extractions.saveNature(source.workspaceId, source.id, { ...sibling })
            return { kind: "ready", nature: natureInForce(sibling, override), calls: 0 }
        }
        if (await this.usage.blockedBy(source.workspaceId, "brain", false)) return { kind: "blocked" }
        const form = formOf(fileTypeOf(source.storagePath), texts)
        const mates = [...(form === null ? [] : await this.formMatesOf(source, form, whole)), ...(await this.siblingsOf(source, whole))]
        const index = whole.indexOf(source.id)
        const part = whole.length > 1 && index >= 0 ? { number: index + 1, of: whole.length } : undefined
        const map: DocumentMap = { ...mapOf(source.title, source.storagePath, texts), mates, ...(part === undefined ? {} : { part }) }
        const read = await this.read(source, map, contentHash)
        if (read === null) return { kind: "retry" }
        // A fallback (no readable answer, or one that contradicted itself twice) is no judgement: it disagrees with nobody.
        const disagrees = read.reading.by === "model" ? disagreeingOf(read.reading.nature, mates) : []
        const reading: NatureReading = { ...read.reading, form, evidence: evidenceIn(read.reading.evidence ?? [], texts), disagreesWith: disagrees }
        await this.extractions.saveNature(source.workspaceId, source.id, { ...reading })
        await this.toldMates(source, reading, disagrees)
        this.logger.info(FactReadingLogEvent.NatureJudged, {
            sourceId: source.id,
            nature: read.reading.nature,
            entries: read.reading.entries ?? "none",
            by: read.reading.by,
            calls: read.calls,
            tables: Object.keys(read.reading.tables).length,
            disagrees: disagrees.length,
        })
        return { kind: "ready", nature: natureInForce(reading, override), calls: read.calls }
    }

    /**
     * The model judgements of other documents of this form in the workspace (TRIAGE-6), with what the map shows of them (title, reason,
     * entries, quotes). Only judgements of this map version count (an older version's test is not this one's), and parts of this
     * document's own file are left to `siblingsOf`.
     */
    private async formMatesOf(source: SourceRecord, form: string, whole: ReadonlyArray<string>): Promise<ReadonlyArray<FormMate>> {
        const stored = await this.extractions.formMates(source.workspaceId, source.id, form)
        return stored.flatMap((one): Array<FormMate> => {
            const reading = storedReadingOf(one.reading)
            if (reading?.version !== NATURE_VERSION || whole.includes(one.sourceId)) return []
            return [
                {
                    sourceId: one.sourceId,
                    nature: reading.nature,
                    title: one.title,
                    reason: reading.reason,
                    entries: reading.entries ?? null,
                    evidence: reading.evidence ?? [],
                },
            ]
        })
    }

    /**
     * The model judgements of OTHER PARTS of this document's file (NATURE_VERSION 5), whatever their form: the nearest parts first, at
     * most `SIBLINGS_READ` read and `SIBLINGS_SHOWN` shown, only judgements of this map version by the model. Each carries its part
     * number, entries and quotes, so the map shows what the other parts were judged ON, and is marked `sameFile` (shown, never applied).
     */
    private async siblingsOf(source: SourceRecord, whole: ReadonlyArray<string>): Promise<ReadonlyArray<FormMate>> {
        const index = whole.indexOf(source.id)
        if (whole.length < 2 || index < 0) return []
        const nearest = whole
            .map((id, at) => ({ id, at }))
            .filter((one) => one.id !== source.id)
            .sort((left, right) => Math.abs(left.at - index) - Math.abs(right.at - index) || left.at - right.at)
            .slice(0, SIBLINGS_READ)
        const read = await Promise.all(
            nearest.map(async (one) => ({ ...one, reading: storedReadingOf((await this.extractions.natureOf(source.workspaceId, one.id)).reading) })),
        )
        return read
            .flatMap((one): Array<FormMate> => {
                const reading = one.reading
                if (reading?.by !== "model" || reading.version !== NATURE_VERSION) return []
                return [
                    {
                        sourceId: one.id,
                        nature: reading.nature,
                        reason: reading.reason,
                        entries: reading.entries ?? null,
                        evidence: reading.evidence ?? [],
                        sameFile: true,
                        part: one.at + 1,
                    },
                ]
            })
            .slice(0, SIBLINGS_SHOWN)
            .sort((left, right) => (left.part ?? 0) - (right.part ?? 0))
    }

    /**
     * Tells every like document judged otherwise (TRIAGE-6): its stored reading names this one too (both are shown to the founder), and
     * a mate whose passages now inherit another verdict (it was judged records / log / reference and this one rules) is read again at
     * triage: its reading reopened and its job queued, in one transaction. Never silent, never a second judgement by code.
     */
    private async toldMates(source: SourceRecord, reading: NatureReading, disagrees: ReadonlyArray<FormMate>): Promise<void> {
        if (disagrees.length === 0) return
        const changed: Array<string> = []
        await eachInOrder(disagrees, async (mate) => {
            // A part of the same file is told so: the disagreement is shown to the founder, never applied (`natureInForce`).
            const me: FormMate =
                mate.sameFile === true ? { sourceId: source.id, nature: reading.nature, sameFile: true } : { sourceId: source.id, nature: reading.nature }
            const stored = storedReadingOf((await this.extractions.natureOf(source.workspaceId, mate.sourceId)).reading)
            if (stored === null) return
            const before = natureInForce(stored, null).nature
            const named = [...(stored.disagreesWith ?? []).filter((one) => one.sourceId !== source.id), me].slice(0, 5)
            const updated: NatureReading = { ...stored, disagreesWith: named }
            await this.extractions.saveNature(source.workspaceId, mate.sourceId, { ...updated })
            if (natureInForce(updated, null).nature !== before) changed.push(mate.sourceId)
        })
        if (changed.length === 0) return
        await this.entityManager.transaction(async (tx) => {
            const opened = await this.extractions.reopenAtTriage(source.workspaceId, changed, tx)
            await eachInOrder(opened, (id) => this.queue.enqueueFactsNext({ sourceId: id, workspaceId: source.workspaceId }, tx, `form:${source.id}`))
        })
    }

    /**
     * The reading a part takes from another part of its file for no call: when EVERY passage of this part is a table whose header another
     * part's reading (this map version) judged, this part is more of the same tables. Null otherwise.
     */
    private async fromSibling(
        source: SourceRecord,
        whole: ReadonlyArray<string>,
        texts: ReadonlyArray<string>,
        contentHash: string,
    ): Promise<NatureReading | null> {
        const shapes = texts.map((text) => tableShapeOf(text))
        if (shapes.length === 0 || shapes.includes(null)) return null
        const keys = shapes.flatMap((shape) => (shape === null ? [] : [tableKeyOf(shape.header)]))
        const others = await Promise.all(
            whole.filter((one) => one !== source.id).map(async (id) => storedReadingOf((await this.extractions.natureOf(source.workspaceId, id)).reading)),
        )
        const other = others.find(
            (one) => one?.by === "model" && one.version === NATURE_VERSION && keys.every((key) => one.tables[key] !== undefined),
        )
        if (other === undefined || other === null) return null
        // The sections of a mixed part do not carry over: the tables of this part decide (`inheritedOf`).
        return { ...other, contentHash, nature: other.nature === "mixed" ? "rules" : other.nature, sections: [] }
    }

    /**
     * Asks the model for the map's judgement; once more with its own answer in front of it when that could not be read. Answers the
     * reading and the calls made, a `fallback` reading when no answer could be read, or null when the model did not answer at all.
     */
    private async read(
        source: SourceRecord,
        map: DocumentMap,
        contentHash: string,
    ): Promise<{ readonly reading: NatureReading; readonly calls: number } | null> {
        const prompt = naturePrompt(map)
        const first = await this.ask(source, [{ role: "user", content: prompt }], 1)
        if (!first.ok && !wroteNothingUsable(first)) return null
        const parsed = first.ok ? parseNature(this.json.jsonOf(first.answer.text, source.workspaceId), map, contentHash) : null
        if (parsed !== null && !contradictsItself(parsed)) return { reading: parsed, calls: 1 }
        // Unreadable: asked again with its own answer; readable but contradicting itself: asked again with the contradiction named.
        const turns: ReadonlyArray<AiMessage> = first.ok
            ? [
                  { role: "user", content: prompt },
                  { role: "assistant", content: first.answer.text.slice(0, 16_000) },
                  { role: "user", content: parsed === null ? FOLLOW_UP : recheckPrompt(parsed) },
              ]
            : [{ role: "user", content: prompt }]
        const second = await this.ask(source, turns, 2)
        const again = second.ok ? parseNature(this.json.jsonOf(second.answer.text, source.workspaceId), map, contentHash) : null
        if (again !== null && !contradictsItself(again)) return { reading: again, calls: 2 }
        const contradicting = again ?? parsed
        if (contradicting !== null) {
            // Two answers that contradict themselves are no judgement of the whole: every passage is triaged by the model.
            this.logger.warn(FactReadingLogEvent.NatureFallback, { sourceId: source.id, nature: contradicting.nature, entries: contradicting.entries ?? "none" })
            return { reading: undecidedOf(contradicting), calls: 2 }
        }
        this.logger.warn(FactReadingLogEvent.NatureFallback, { sourceId: source.id })
        return { reading: fallbackReading(contentHash), calls: 2 }
    }

    /** One call, metered as `brain` on the `nature` step of the document's reading. */
    private ask(source: SourceRecord, turns: ReadonlyArray<AiMessage>, tryNumber: number): Promise<AiChatAttempt> {
        return withWorkStep("nature", "document_read", async () => {
            const tried = await this.ai.attempt({
                messages: [{ role: "system", content: NATURE_PROMPT, cacheMark: true }, ...turns],
                json: false,
                schema: null,
                timeoutMs: CALL_TIMEOUT_MS,
                budget: { effort: NATURE_EFFORT, maxTokens: NATURE_MAX_TOKENS },
                // The answer as the API's structured output where the route has it; the text is parsed the same way either way.
                outputSchema: NATURE_SCHEMA,
                context: null,
                affinity: source.workspaceId,
                // What a document is, is a decision of meaning: the strong model (owner 2026-11-12).
                target: INGESTION_TARGET,
            })
            const spend = spendOf(tried)
            if (spend !== null) {
                await this.usage.record({
                    workspaceId: source.workspaceId,
                    kind: "brain",
                    module: "knowledge",
                    promptChars: NATURE_PROMPT.length + turns.reduce((sum, turn) => sum + turn.content.length, 0),
                    tryNumber,
                    ...spend,
                })
            }
            return tried
        })
    }
}
